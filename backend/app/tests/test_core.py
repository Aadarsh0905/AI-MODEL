import pytest
import numpy as np
from app.services.mission_planning import MissionPlanningService
from app.services.navigation import NavigationService
from app.services.terrain_analysis import TerrainAnalysisService
from app.services.gis_analytics import GISAnalyticsService
from app.services.ai_engine import AIEngineService

def test_grid_mission_planning():
    bbox = {
        "min_lat": 27.700, "max_lat": 27.705,
        "min_lon": 85.310, "max_lon": 85.315
    }
    # Generate waypoints
    wps = MissionPlanningService.generate_grid_flight_plan(bbox, altitude=60.0)
    
    assert len(wps) > 0
    assert wps[0]["sequence"] == 1
    assert wps[0]["altitude"] == 60.0

def test_battery_estimation():
    wps = [
        {"sequence": 1, "latitude": 27.700, "longitude": 85.310, "altitude": 60.0, "speed": 5.0},
        {"sequence": 2, "latitude": 27.705, "longitude": 85.310, "altitude": 60.0, "speed": 5.0}
    ]
    # Estimate battery with high wind vectors
    res = MissionPlanningService.estimate_battery_consumption(wps, wind_speed_mps=4.0, wind_direction_deg=90.0)
    
    assert "battery_remaining_percentage" in res
    assert res["battery_remaining_percentage"] <= 100.0
    assert res["total_distance_m"] > 0.0

def test_navigation_potential_field():
    nav = NavigationService(27.700, 85.310, 0.0)
    nav.state = "WAYPOINT"
    
    # Target coordinate slightly offset
    curr_lat, curr_lon, curr_alt = nav.update_position(
        target_lat=27.701,
        target_lon=85.311,
        target_alt=60.0,
        speed_mps=10.0,
        dt_seconds=1.0
    )
    
    assert curr_alt > 0.0
    assert nav.yaw > 0.0 or nav.yaw == 0.0

def test_terrain_slope_and_aspect():
    # Construct synthetic DEM dome shape
    dem = np.zeros((10, 10))
    dem[3:7, 3:7] = 50.0 # elevation peak
    
    slope, aspect = TerrainAnalysisService.calculate_slope_and_aspect(dem, resolution=10.0)
    
    assert slope.shape == (10, 10)
    assert aspect.shape == (10, 10)
    assert float(np.max(slope)) > 0.0

def test_gis_buffers():
    wkt_point = "POINT(85.310 27.700)"
    buffered_wkt = GISAnalyticsService.vector_buffer(wkt_point, distance_deg=0.001)
    
    assert "POLYGON" in buffered_wkt

def test_ai_accuracy_validation():
    # Two offset boxes
    box_det = "POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))"
    box_gt  = "POLYGON((1 1, 3 1, 3 3, 1 3, 1 1))"
    
    metrics = AIEngineService.validate_detections(box_det, box_gt)
    
    # Intersection is 1x1 box, Union is 7 sqm
    # IoU = 1/7 = 0.1428
    assert metrics["iou"] == 0.1429
    assert metrics["precision"] == 0.25
    assert metrics["recall"] == 0.25
