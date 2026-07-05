from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class WaypointBase(BaseModel):
    sequence: int
    latitude: float
    longitude: float
    altitude: float
    speed: float = 5.0
    action: str = "WAYPOINT"
    status: str = "PENDING"
    terrain_elevation: Optional[float] = None

class WaypointCreate(WaypointBase):
    pass

class WaypointResponse(WaypointBase):
    id: int
    mission_id: int

    class Config:
        from_attributes = True

class MissionBase(BaseModel):
    project_id: int
    name: str
    description: Optional[str] = None
    status: str = "PLANNED"
    weather_info: Optional[str] = None
    battery_estimated_percentage: Optional[float] = None
    battery_used_percentage: Optional[float] = None
    flight_path: Optional[str] = None

class MissionCreate(BaseModel):
    project_id: int
    name: str
    description: Optional[str] = None
    waypoints: List[WaypointCreate]

class MissionResponse(MissionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    waypoints: List[WaypointResponse] = []

    class Config:
        from_attributes = True

class GridPlanRequest(BaseModel):
    bbox: Dict[str, float]  # min_lat, min_lon, max_lat, max_lon
    altitude: float
    overlap: float = 0.75
    camera_fov: float = 70.0
    flight_speed: float = 5.0
    dem_path: Optional[str] = None

class BatteryEstimateRequest(BaseModel):
    waypoints: List[WaypointCreate]
    wind_speed: float = 0.0
    wind_direction: float = 0.0
    drone_mass: float = 2.5
    battery_capacity: float = 10.0
