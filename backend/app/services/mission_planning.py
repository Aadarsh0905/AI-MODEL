import math
from typing import List, Dict, Any, Tuple
import numpy as np
import rasterio
from shapely.geometry import Polygon, Point

# Haversine distance helper
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# Destination point given distance and bearing
def destination_point(lat: float, lon: float, distance: float, bearing_degrees: float) -> Tuple[float, float]:
    R = 6371000.0
    bearing = math.radians(bearing_degrees)
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)

    lat2 = math.asin(math.sin(lat_rad) * math.cos(distance / R) +
                     math.cos(lat_rad) * math.sin(distance / R) * math.cos(bearing))
    lon2 = lon_rad + math.atan2(math.sin(bearing) * math.sin(distance / R) * math.cos(lat_rad),
                               math.cos(distance / R) - math.sin(lat_rad) * math.sin(lat2))
    
    return math.degrees(lat2), math.degrees(lon2)

class MissionPlanningService:
    @staticmethod
    def generate_grid_flight_plan(
        bbox: Dict[str, float],  # {'min_lat': float, 'min_lon': float, 'max_lat': float, 'max_lon': float}
        altitude: float,         # Relative altitude above ground (m)
        overlap: float = 0.75,   # Front/side overlap fraction
        camera_fov: float = 70.0, # Camera Field of View in degrees
        flight_speed: float = 5.0 # Flight speed in m/s
    ) -> List[Dict[str, Any]]:
        """
        Generates a standard boustrophedon (grid) flight path over a bounding box.
        Aligns swathes to cover the area completely considering camera FOV and overlap.
        """
        # Calculate ground footprint width (W)
        # W = 2 * alt * tan(FOV/2)
        footprint_width = 2.0 * altitude * math.tan(math.radians(camera_fov / 2.0))
        swath_spacing = footprint_width * (1.0 - overlap)

        min_lat, max_lat = bbox["min_lat"], bbox["max_lat"]
        min_lon, max_lon = bbox["min_lon"], bbox["max_lon"]

        # Calculate dimensions in meters
        height_m = haversine_distance(min_lat, min_lon, max_lat, min_lon)
        width_m = haversine_distance(min_lat, min_lon, min_lat, max_lon)

        num_swaths = max(2, int(math.ceil(width_m / swath_spacing)))
        
        waypoints = []
        seq = 1

        # Generate boustrophedon track
        for i in range(num_swaths):
            # Calculate longitude fraction
            lon_frac = i / (num_swaths - 1) if num_swaths > 1 else 0.5
            curr_lon = min_lon + lon_frac * (max_lon - min_lon)

            # Alternate directions
            if i % 2 == 0:
                # South to North
                waypoints.append({
                    "sequence": seq,
                    "latitude": min_lat,
                    "longitude": curr_lon,
                    "altitude": altitude,
                    "speed": flight_speed,
                    "action": "WAYPOINT"
                })
                seq += 1
                waypoints.append({
                    "sequence": seq,
                    "latitude": max_lat,
                    "longitude": curr_lon,
                    "altitude": altitude,
                    "speed": flight_speed,
                    "action": "WAYPOINT"
                })
                seq += 1
            else:
                # North to South
                waypoints.append({
                    "sequence": seq,
                    "latitude": max_lat,
                    "longitude": curr_lon,
                    "altitude": altitude,
                    "speed": flight_speed,
                    "action": "WAYPOINT"
                })
                seq += 1
                waypoints.append({
                    "sequence": seq,
                    "latitude": min_lat,
                    "longitude": curr_lon,
                    "altitude": altitude,
                    "speed": flight_speed,
                    "action": "WAYPOINT"
                })
                seq += 1
        
        return waypoints

    @staticmethod
    def apply_terrain_awareness(
        waypoints: List[Dict[str, Any]],
        dem_path: str
    ) -> List[Dict[str, Any]]:
        """
        Adjusts relative waypoint altitudes to maintain constant height above ground (terrain following)
        by loading elevations from a Digital Elevation Model (DEM) raster.
        """
        adjusted_waypoints = []
        try:
            with rasterio.open(dem_path) as dataset:
                for wp in waypoints:
                    # rasterio index queries use (lon, lat)
                    row, col = dataset.index(wp["longitude"], wp["latitude"])
                    if 0 <= row < dataset.height and 0 <= col < dataset.width:
                        elevation = dataset.read(1)[row, col]
                        # Handle nodata values
                        if elevation == dataset.nodata or elevation < -100:
                            elevation = 0.0
                    else:
                        elevation = 0.0

                    adjusted_waypoints.append({
                        **wp,
                        "terrain_elevation": float(elevation),
                        "altitude": float(wp["altitude"] + elevation) # Absolute altitude MSL
                    })
        except Exception as e:
            # Fallback to no-terrain lookup if DEM cannot be loaded
            for wp in waypoints:
                adjusted_waypoints.append({
                    **wp,
                    "terrain_elevation": 0.0,
                    "altitude": wp["altitude"]
                })
        return adjusted_waypoints

    @staticmethod
    def check_no_fly_zones(
        waypoints: List[Dict[str, Any]],
        nfz_polygons_wkt: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Validates waypoints against a list of No-Fly Zone polygons.
        Marks violated waypoints as BLOCKED.
        """
        from shapely.wkt import loads
        nfzs = [loads(wkt) for wkt in nfz_polygons_wkt]
        
        validated = []
        for wp in waypoints:
            pt = Point(wp["longitude"], wp["latitude"])
            in_nfz = False
            for nfz in nfzs:
                if nfz.contains(pt):
                    in_nfz = True
                    break
            
            validated.append({
                **wp,
                "status": "BLOCKED" if in_nfz else "PENDING"
            })
        return validated

    @staticmethod
    def estimate_battery_consumption(
        waypoints: List[Dict[str, Any]],
        wind_speed_mps: float = 0.0,
        wind_direction_deg: float = 0.0,
        drone_mass_kg: float = 2.5,
        nominal_voltage: float = 22.2,  # 6S LiPo
        battery_capacity_ah: float = 10.0
    ) -> Dict[str, Any]:
        """
        Estimates total flight time, power consumption, and battery percent remaining.
        Utilizes a physics-based drone flight model with wind velocity vectoring.
        """
        total_distance = 0.0
        total_time_seconds = 0.0
        total_energy_joules = 0.0

        # Drag coefficient + projected area constant (C_D * A / 2 * rho)
        drag_constant = 0.05 
        gravity = 9.81
        hover_power = 350.0 # Watts required to hover drone_mass_kg

        wind_rad = math.radians(wind_direction_deg)
        wind_x = wind_speed_mps * math.cos(wind_rad)
        wind_y = wind_speed_mps * math.sin(wind_rad)

        for i in range(len(waypoints) - 1):
            wp1 = waypoints[i]
            wp2 = waypoints[i+1]
            
            dist = haversine_distance(wp1["latitude"], wp1["longitude"], wp2["latitude"], wp2["longitude"])
            dh = float(wp2["altitude"] - wp1["altitude"])
            dist_3d = math.sqrt(dist**2 + dh**2)
            total_distance += dist_3d

            # Calculate bearing from wp1 to wp2
            bearing = math.atan2(
                wp2["longitude"] - wp1["longitude"],
                wp2["latitude"] - wp1["latitude"]
            )

            # Ground velocity vector
            speed = float(wp1["speed"])
            vg_x = speed * math.sin(bearing)
            vg_y = speed * math.cos(bearing)

            # Air velocity vector (v_air = v_ground - v_wind)
            va_x = vg_x - wind_x
            va_y = vg_y - wind_y
            airspeed = math.sqrt(va_x**2 + va_y**2)

            # Time to traverse segment
            seg_time = dist_3d / speed if speed > 0 else 0.0
            total_time_seconds += seg_time

            # Aerodynamic power consumption: Power = Hover_Power + Drag * Airspeed^3 + Climb_Power
            climb_power = drone_mass_kg * gravity * (dh / seg_time) if seg_time > 0 else 0.0
            climb_power = max(climb_power, -0.5 * hover_power) # Regenerative breaking limit
            
            drag_power = drag_constant * (airspeed ** 3)
            segment_power = hover_power + drag_power + climb_power
            
            total_energy_joules += segment_power * seg_time

        # Convert Joules to Watt-hours (Wh) and Amp-hours (Ah)
        total_energy_wh = total_energy_joules / 3600.0
        ah_used = total_energy_wh / nominal_voltage
        
        battery_percentage_used = (ah_used / battery_capacity_ah) * 100.0
        battery_remaining_percentage = max(0.0, 100.0 - battery_percentage_used)

        return {
            "total_distance_m": round(total_distance, 2),
            "total_flight_time_seconds": round(total_time_seconds, 2),
            "energy_consumed_wh": round(total_energy_wh, 2),
            "battery_used_percentage": round(battery_percentage_used, 2),
            "battery_remaining_percentage": round(battery_remaining_percentage, 2)
        }

    @staticmethod
    def mock_weather_forecast(lat: float, lon: float) -> Dict[str, Any]:
        """
        Simulates checking weather forecasts for mission planning operations.
        Returns safety status flags.
        """
        # Static mock data representing a good weather day for UAV operations
        wind_speed = 4.2 # m/s
        precipitation_probability = 10 # %
        visibility_meters = 10000
        
        is_safe = wind_speed < 12.0 and precipitation_probability < 40 and visibility_meters > 5000
        
        return {
            "wind_speed_mps": wind_speed,
            "wind_direction_deg": 180.0,
            "temperature_c": 22.5,
            "humidity_pct": 55,
            "precipitation_probability": precipitation_probability,
            "visibility_meters": visibility_meters,
            "is_safe_to_fly": is_safe,
            "warnings": [] if is_safe else ["High wind warnings or low visibility present."]
        }
