import math
from typing import List, Dict, Any, Tuple

class NavigationService:
    def __init__(self, start_lat: float, start_lon: float, start_alt: float = 0.0):
        # Current simulated state
        self.latitude = start_lat
        self.longitude = start_lon
        self.altitude = start_alt
        self.pitch = 0.0
        self.roll = 0.0
        self.yaw = 0.0
        self.state = "LANDED"  # LANDED, TAKING_OFF, WAYPOINT, RTL, LANDING, EMERGENCY
        self.battery_percentage = 100.0
        
        # SLAM variables
        self.position_uncertainty_m = 0.02  # RTK GNSS initially
        self.gyro_drift_rate = 0.001       # deg/sec

    def update_position(
        self,
        target_lat: float,
        target_lon: float,
        target_alt: float,
        speed_mps: float,
        dt_seconds: float,
        obstacles: List[Dict[str, float]] = None # [{'lat': x, 'lon': y, 'alt': z, 'radius_m': r}]
    ) -> Tuple[float, float, float]:
        """
        Updates the drone's position using a 3D Artificial Potential Field for obstacle avoidance.
        Attracts to the waypoint, repels from obstacles.
        """
        if self.state in ["LANDED"]:
            return self.latitude, self.longitude, self.altitude

        # Vector pointing to target in local ENU (East-North-Up) tangent plane approximation
        # East coordinate change (meters)
        R = 6371000.0
        dlat = math.radians(target_lat - self.latitude)
        dlon = math.radians(target_lon - self.longitude)
        
        dy = dlat * R
        dx = dlon * R * math.cos(math.radians(self.latitude))
        dz = target_alt - self.altitude

        dist_target = math.sqrt(dx**2 + dy**2 + dz**2)
        step_dist = speed_mps * dt_seconds

        if dist_target <= step_dist or dist_target < 0.5:
            # Reached target, snap exactly to coordinates
            self.latitude = target_lat
            self.longitude = target_lon
            self.altitude = target_alt
            return self.latitude, self.longitude, self.altitude

        # Normalize attractive vector
        f_attr_x = dx / dist_target
        f_attr_y = dy / dist_target
        f_attr_z = dz / dist_target

        # Repulsive vector calculation from obstacles
        f_rep_x, f_rep_y, f_rep_z = 0.0, 0.0, 0.0
        repulsion_gain = 50.0  # Force factor

        if obstacles:
            for obs in obstacles:
                # Calculate distance to obstacle center
                o_dlat = math.radians(obs["lat"] - self.latitude)
                o_dlon = math.radians(obs["lon"] - self.longitude)
                o_dy = o_dlat * R
                o_dx = o_dlon * R * math.cos(math.radians(self.latitude))
                o_dz = obs["alt"] - self.altitude
                
                dist_obs = math.sqrt(o_dx**2 + o_dy**2 + o_dz**2)
                safety_margin = obs["radius_m"] + 5.0 # Stop 5m before the obstacle radius
                
                if dist_obs < safety_margin:
                    # Repulsion activated (potential field formula: U = 0.5 * k * (1/d - 1/d0)^2)
                    if dist_obs > 0.1:
                        # Vector from obstacle to drone (repulsion direction)
                        rx = -o_dx / dist_obs
                        ry = -o_dy / dist_obs
                        rz = -o_dz / dist_obs
                        
                        # Magnitude of repulsion
                        force = repulsion_gain * (1.0 / dist_obs - 1.0 / safety_margin)
                        
                        f_rep_x += rx * force
                        f_rep_y += ry * force
                        f_rep_z += rz * force

        # Net forces
        net_x = f_attr_x + f_rep_x
        net_y = f_attr_y + f_rep_y
        net_z = f_attr_z + f_rep_z

        net_mag = math.sqrt(net_x**2 + net_y**2 + net_z**2)
        if net_mag > 0:
            dir_x = net_x / net_mag
            dir_y = net_y / net_mag
            dir_z = net_z / net_mag
        else:
            dir_x, dir_y, dir_z = 0.0, 0.0, 0.0

        # Update position
        step_dist = speed_mps * dt_seconds
        new_dx = dir_x * step_dist
        new_dy = dir_y * step_dist
        new_dz = dir_z * step_dist

        # Convert local offset back to GPS coordinates
        new_lat = self.latitude + math.degrees(new_dy / R)
        new_lon = self.longitude + math.degrees(new_dx / (R * math.cos(math.radians(self.latitude))))
        new_alt = self.altitude + new_dz

        self.latitude = new_lat
        self.longitude = new_lon
        self.altitude = new_alt

        # Update yaw based on travel direction (only if actually moving horizontally)
        if abs(new_dx) > 1e-7 or abs(new_dy) > 1e-7:
            self.yaw = math.degrees(math.atan2(new_dx, new_dy)) % 360.0
            self.pitch = math.degrees(math.atan2(new_dz, math.sqrt(new_dx**2 + new_dy**2)))
        elif abs(new_dz) > 1e-7:
            # Moving vertically only, pitch is 90 (up) or -90 (down), yaw remains unchanged
            self.pitch = 90.0 if new_dz > 0 else -90.0
        self.roll = 0.0  # Bank angle could be modelled but keeping simple for telemetry

        # Update SLAM uncertainty
        self.position_uncertainty_m += 0.005 * dt_seconds  # Drift over time

        return self.latitude, self.longitude, self.altitude

    def get_slam_state(self, satellite_count: int = 15) -> Dict[str, Any]:
        """
        Simulates SLAM filter diagnostics. When GPS count is high, RTK coordinates
        reset drift. In GPS-denied environments, visual-inertial odometry drifts.
        """
        if satellite_count >= 8:
            # Good GNSS, slam error correction
            self.position_uncertainty_m = max(0.02, self.position_uncertainty_m * 0.9)
            sensor_mode = "GNSS-RTK Centimeter Precision"
        else:
            # GPS-denied fallback to Visual SLAM
            sensor_mode = "Visual-Inertial Odometry (VIO)"
        
        return {
            "mode": sensor_mode,
            "position_uncertainty_meters": round(self.position_uncertainty_m, 3),
            "attitude_drift_deg": round(self.gyro_drift_rate * 100.0, 3)
        }
