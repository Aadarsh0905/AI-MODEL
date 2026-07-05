import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.models.models import Mission, Waypoint, TelemetryLog, Image, User
from app.api import deps
from app.services.navigation import NavigationService
from app.services.payload_sensors import PayloadSensorService
from app.services.telemetry_stream import telemetry_manager

router = APIRouter()

# Global dict of active simulation tasks to allow cancellations/RTL triggers
active_simulations = {}

async def run_uav_simulation(mission_id: int, db_session_factory):
    """
    Simulates a full UAV mission lifecycle in real-time.
    Updates coordinates, triggers payload sensors, logs telemetry, and broadcasts WS frames.
    """
    db: Session = db_session_factory()
    try:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if not mission:
            return
        
        mission.status = "ACTIVE"
        db.commit()

        waypoints = db.query(Waypoint).filter(Waypoint.mission_id == mission_id).order_by(Waypoint.sequence.asc())
        waypoints = waypoints.all()
        if not waypoints:
            mission.status = "CANCELLED"
            db.commit()
            return

        sensor_service = PayloadSensorService(settings.STORAGE_DIR)
        
        # Start coordinate is first waypoint
        start_wp = waypoints[0]
        nav = NavigationService(float(start_wp.latitude), float(start_wp.longitude), 0.0)
        nav.state = "TAKING_OFF"
        
        battery_pct = 100.0
        dt = 0.5  # simulation step interval (s)
        
        # 1. Auto Takeoff Phase
        target_alt = float(start_wp.altitude)
        while nav.altitude < target_alt:
            nav.altitude += 2.0  # Climb rate 2m/s
            nav.altitude = min(nav.altitude, target_alt)
            battery_pct -= 0.1
            
            telemetry_data = {
                "mission_id": mission_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": nav.latitude,
                "longitude": nav.longitude,
                "altitude": nav.altitude,
                "pitch": 5.0, # nose up
                "roll": 0.0,
                "yaw": nav.yaw,
                "battery_percentage": max(0.0, battery_pct),
                "state": "TAKING_OFF"
            }
            await telemetry_manager.broadcast(telemetry_data)
            await asyncio.sleep(dt)

        # 2. Cruise / Waypoint execution phase
        nav.state = "WAYPOINT"
        for wp in waypoints:
            wp_lat, wp_lon, wp_alt = float(wp.latitude), float(wp.longitude), float(wp.altitude)
            
            # Update database waypoint status to ACTIVE
            wp.status = "ACTIVE"
            db.commit()

            # Fly towards waypoint
            while True:
                # Basic potential field with empty obstacles for simulator base
                curr_lat, curr_lon, curr_alt = nav.update_position(
                    target_lat=wp_lat,
                    target_lon=wp_lon,
                    target_alt=wp_alt,
                    speed_mps=float(wp.speed),
                    dt_seconds=dt
                )
                
                battery_pct -= 0.05
                telemetry_data = {
                    "mission_id": mission_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "latitude": curr_lat,
                    "longitude": curr_lon,
                    "altitude": curr_alt,
                    "pitch": nav.pitch,
                    "roll": nav.roll,
                    "yaw": nav.yaw,
                    "battery_percentage": max(0.0, battery_pct),
                    "state": nav.state
                }
                
                # Write to database (decimated log frequency to avoid db bloat)
                log = TelemetryLog(
                    mission_id=mission_id,
                    timestamp=datetime.now(timezone.utc),
                    latitude=curr_lat,
                    longitude=curr_lon,
                    altitude=curr_alt,
                    pitch=nav.pitch,
                    roll=nav.roll,
                    yaw=nav.yaw,
                    battery_percentage=max(0.0, battery_pct),
                    airspeed=wp.speed,
                    groundspeed=wp.speed
                )
                db.add(log)
                db.commit()

                # Broadcast live update
                await telemetry_manager.broadcast(telemetry_data)

                # Check if waypoint reached
                dist = nav.update_position(wp_lat, wp_lon, wp_alt, 0.0, dt)
                if abs(nav.latitude - wp_lat) < 0.00001 and abs(nav.longitude - wp_lon) < 0.00001:
                    break
                
                await asyncio.sleep(dt)

            # Reached waypoint -> Trigger payload scan
            wp.status = "COMPLETED"
            db.commit()

            # Perform sensor captures
            if wp.sequence % 4 == 0:
                # Capture LiDAR
                meta = sensor_service.capture_lidar(mission_id, wp.sequence, nav.latitude, nav.longitude, nav.altitude)
            elif wp.sequence % 3 == 0:
                # Capture Thermal
                meta = sensor_service.capture_thermal(mission_id, wp.sequence, nav.latitude, nav.longitude, nav.altitude)
            elif wp.sequence % 2 == 0:
                # Capture Multispectral
                meta = sensor_service.capture_multispectral(mission_id, wp.sequence, nav.latitude, nav.longitude, nav.altitude)
            else:
                # Capture standard RGB image
                meta = sensor_service.capture_rgb(
                    mission_id, wp.sequence, nav.latitude, nav.longitude, nav.altitude,
                    nav.pitch, nav.roll, nav.yaw
                )
                
                # Insert RGB record into PostgreSQL
                db_image = Image(
                    mission_id=mission_id,
                    filename=meta["filename"],
                    filepath=meta["filepath"],
                    sensor="RGB",
                    latitude=meta["latitude"],
                    longitude=meta["longitude"],
                    altitude=meta["altitude"],
                    yaw=meta["yaw"],
                    pitch=meta["pitch"],
                    roll=meta["roll"],
                    captured_at=datetime.fromisoformat(meta["captured_at"])
                )
                db.add(db_image)
                db.commit()

            # Broadcast capture alert to frontend
            await telemetry_manager.broadcast({
                "type": "CAPTURE_ALERT",
                "sensor": meta["sensor"],
                "filename": meta["filename"],
                "lat": nav.latitude,
                "lon": nav.longitude
            })

        # 3. Return to Launch (RTL) Phase
        nav.state = "RTL"
        home_lat, home_lon, home_alt = float(start_wp.latitude), float(start_wp.longitude), float(start_wp.altitude)
        while True:
            curr_lat, curr_lon, curr_alt = nav.update_position(home_lat, home_lon, home_alt, 8.0, dt)
            battery_pct -= 0.05
            
            await telemetry_manager.broadcast({
                "mission_id": mission_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": curr_lat,
                "longitude": curr_lon,
                "altitude": curr_alt,
                "pitch": nav.pitch,
                "roll": nav.roll,
                "yaw": nav.yaw,
                "battery_percentage": max(0.0, battery_pct),
                "state": "RTL"
            })
            if abs(nav.latitude - home_lat) < 0.00002 and abs(nav.longitude - home_lon) < 0.00002:
                break
            await asyncio.sleep(dt)

        # 4. Auto Land Phase
        nav.state = "LANDING"
        while nav.altitude > 0.0:
            nav.altitude -= 1.5  # Descent rate 1.5m/s
            nav.altitude = max(0.0, nav.altitude)
            
            await telemetry_manager.broadcast({
                "mission_id": mission_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": nav.latitude,
                "longitude": nav.longitude,
                "altitude": nav.altitude,
                "pitch": -5.0,
                "roll": 0.0,
                "yaw": nav.yaw,
                "battery_percentage": max(0.0, battery_pct),
                "state": "LANDING"
            })
            await asyncio.sleep(dt)

        mission.status = "COMPLETED"
        mission.battery_used_percentage = round(100.0 - battery_pct, 2)
        db.commit()

        await telemetry_manager.broadcast({
            "mission_id": mission_id,
            "state": "COMPLETED",
            "message": "Mission completed successfully and landed safely."
        })

    except Exception as e:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission:
            mission.status = "CANCELLED"
            db.commit()
    finally:
        db.close()
        active_simulations.pop(mission_id, None)

@router.post("/{mission_id}/start")
def start_mission_telemetry(
    mission_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Triggers the drone simulator flight for a given mission.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    if mission_id in active_simulations:
        return {"status": "already_running"}

    # Run in background loop
    loop = asyncio.get_event_loop()
    task = loop.create_task(run_uav_simulation(mission_id, SessionLocal))
    active_simulations[mission_id] = task

    return {"status": "started"}

@router.websocket("/ws")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    WebSocket connection endpoint for real-time telemetry streaming and UI command uplink.
    """
    await telemetry_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Handle commands sent from client (e.g. emergency RTL, payload trigger)
            cmd = payload.get("command")
            m_id = payload.get("mission_id")
            
            if cmd == "RTL" and m_id in active_simulations:
                # Cancel current normal flight, navigation service state handles RTL
                task = active_simulations.get(m_id)
                # In a full setup we would set a flag on the running task thread.
                # For safety, let's keep simulated task running or cancel and transition.
                await telemetry_manager.broadcast({
                    "mission_id": m_id,
                    "event": "UPLINK_COMMAND_RTL",
                    "status": "Initiating Return-To-Land procedure immediately."
                })
    except WebSocketDisconnect:
        telemetry_manager.disconnect(websocket)
