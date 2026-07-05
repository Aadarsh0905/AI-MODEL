from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any

from app.core.database import get_db
from app.api import deps
from app.models.models import Mission, Waypoint, Project, User
from app.schemas.mission import (
    MissionCreate, MissionResponse, GridPlanRequest, 
    BatteryEstimateRequest, WaypointResponse
)
from app.services.mission_planning import MissionPlanningService

router = APIRouter()

@router.post("/plan-grid", response_model=List[Any])
def plan_grid_mission(
    request: GridPlanRequest,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Generate standard grid flight waypoints. If a DEM raster path is supplied,
    it applies terrain-following altitude adjustments.
    """
    wps = MissionPlanningService.generate_grid_flight_plan(
        bbox=request.bbox,
        altitude=request.altitude,
        overlap=request.overlap,
        camera_fov=request.camera_fov,
        flight_speed=request.flight_speed
    )
    if request.dem_path:
        wps = MissionPlanningService.apply_terrain_awareness(wps, request.dem_path)
    return wps

@router.post("/estimate-battery")
def estimate_battery(
    request: BatteryEstimateRequest,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Calculate power usage, travel distance, and battery percent remaining.
    """
    waypoints_dict = [wp.dict() for wp in request.waypoints]
    result = MissionPlanningService.estimate_battery_consumption(
        waypoints=waypoints_dict,
        wind_speed_mps=request.wind_speed,
        wind_direction_deg=request.wind_direction,
        drone_mass_kg=request.drone_mass,
        battery_capacity_ah=request.battery_capacity
    )
    return result

@router.get("/weather-check")
def check_weather(
    lat: float,
    lon: float,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Check flight safety conditions using real-time coordinates.
    """
    return MissionPlanningService.mock_weather_forecast(lat, lon)

@router.post("/create", response_model=MissionResponse)
def create_mission(
    *,
    db: Session = Depends(get_db),
    mission_in: MissionCreate,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Save the mission structure to the database.
    """
    project = db.query(Project).filter(Project.id == mission_in.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Store flight path LineString representation in WKT
    wkt_points = [f"{wp.longitude} {wp.latitude}" for wp in mission_in.waypoints]
    wkt_linestring = f"LINESTRING({', '.join(wkt_points)})" if wkt_points else None

    db_mission = Mission(
        project_id=mission_in.project_id,
        name=mission_in.name,
        description=mission_in.description,
        status="PLANNED",
        flight_path=wkt_linestring
    )
    db.add(db_mission)
    db.commit()
    db.refresh(db_mission)

    for wp in mission_in.waypoints:
        db_wp = Waypoint(
            mission_id=db_mission.id,
            sequence=wp.sequence,
            latitude=wp.latitude,
            longitude=wp.longitude,
            altitude=wp.altitude,
            speed=wp.speed,
            action=wp.action,
            status=wp.status,
            terrain_elevation=wp.terrain_elevation
        )
        db.add(db_wp)
    db.commit()
    db.refresh(db_mission)
    return db_mission

@router.get("/{id}", response_model=MissionResponse)
def get_mission_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    mission = db.query(Mission).filter(Mission.id == id).first()
    if not mission:
        raise HTTPException(
            status_code=404,
            detail="Mission not found"
        )
    return mission
