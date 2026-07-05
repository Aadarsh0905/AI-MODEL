import os
import time
import json
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any
from PIL import Image, ImageDraw

class PayloadSensorService:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def capture_rgb(
        self,
        mission_id: int,
        seq: int,
        lat: float,
        lon: float,
        alt: float,
        pitch: float,
        roll: float,
        yaw: float
    ) -> Dict[str, Any]:
        """
        Simulates RGB camera triggering. Writes a mock JPEG image file with
        embedded metadata and returns metadata dict.
        """
        filename = f"m_{mission_id}_rgb_{seq}_{int(time.time())}.jpg"
        filepath = os.path.join(self.output_dir, "images", filename)
        
        # Create a simple synthetic image (gradient with some shapes)
        img = Image.new("RGB", (640, 480), color=(73, 109, 137))
        d = ImageDraw.Draw(img)
        d.text((20, 20), f"Mission {mission_id} Seq {seq}", fill=(255, 255, 0))
        d.text((20, 40), f"Lat: {lat:.6f} Lon: {lon:.6f} Alt: {alt:.2f}m", fill=(255, 255, 255))
        d.text((20, 60), f"YPR: {yaw:.1f}/{pitch:.1f}/{roll:.1f}", fill=(255, 255, 255))
        
        # Draw a geomorphic-looking feature (simulated river or cliff)
        d.line([(100, 480), (300, 200), (450, 0)], fill=(0, 100, 255), width=25)
        
        img.save(filepath)

        metadata = {
            "filename": filename,
            "filepath": filepath,
            "sensor": "RGB",
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "yaw": yaw,
            "pitch": pitch,
            "roll": roll,
            "captured_at": datetime.now(timezone.utc).isoformat()
        }
        return metadata

    def capture_lidar(
        self,
        mission_id: int,
        seq: int,
        lat: float,
        lon: float,
        alt: float
    ) -> Dict[str, Any]:
        """
        Simulates a LiDAR scan sweep. Generates a mock text/LAS-formatted
        xyz coordinates log representing a terrain surface.
        """
        filename = f"m_{mission_id}_lidar_{seq}_{int(time.time())}.xyz"
        filepath = os.path.join(self.output_dir, "images", filename)

        # Generate a simulated dense surface (grid of points with slope/noise)
        points = []
        for x in np.linspace(-5.0, 5.0, 10):
            for y in np.linspace(-5.0, 5.0, 10):
                # Calculate ground elevation with a river valley slope
                z_ground = float(-0.5 * y + 0.1 * np.random.normal())
                points.append((x, y, z_ground))

        with open(filepath, "w") as f:
            f.write("# X_offset Y_offset Z_elevation\n")
            for pt in points:
                f.write(f"{pt[0]:.3f} {pt[1]:.3f} {pt[2]:.3f}\n")

        return {
            "filename": filename,
            "filepath": filepath,
            "sensor": "LIDAR",
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "captured_at": datetime.now(timezone.utc).isoformat()
        }

    def capture_multispectral(
        self,
        mission_id: int,
        seq: int,
        lat: float,
        lon: float,
        alt: float
    ) -> Dict[str, Any]:
        """
        Simulates multispectral capturing (NIR, Red, Green bands).
        Creates a mock multiband GeoTIFF-style image and returns metadata.
        """
        filename = f"m_{mission_id}_ms_{seq}_{int(time.time())}.png"
        filepath = os.path.join(self.output_dir, "images", filename)

        # Create simulated 3-band matrix (R=Red, G=Green, B=NIR/Infrared)
        width, height = 300, 300
        # Red band: high reflection in soil, low in water
        # Green band: medium in grass
        # NIR band: very high in vegetation, extremely low in water
        # Let's save a synthetic PNG where Red=Red, Green=Green, Blue=NIR (False Color Infrared)
        img_array = np.zeros((height, width, 3), dtype=np.uint8)
        img_array[:, :150, 2] = 200  # NIR (high vegetation response)
        img_array[:, 150:, 0] = 180  # Red soil
        
        img = Image.fromarray(img_array)
        img.save(filepath)

        return {
            "filename": filename,
            "filepath": filepath,
            "sensor": "MULTISPECTRAL",
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "captured_at": datetime.now(timezone.utc).isoformat()
        }

    def capture_thermal(
        self,
        mission_id: int,
        seq: int,
        lat: float,
        lon: float,
        alt: float
    ) -> Dict[str, Any]:
        """
        Simulates thermal camera captures. Generates a JSON array containing
        calibrated temperature values in Celsius.
        """
        filename = f"m_{mission_id}_thermal_{seq}_{int(time.time())}.json"
        filepath = os.path.join(self.output_dir, "images", filename)

        # Generate 10x10 thermal grid
        temp_grid = np.random.normal(loc=24.5, scale=1.5, size=(10, 10)).tolist()

        with open(filepath, "w") as f:
            json.dump({"temperature_celsius": temp_grid}, f, indent=2)

        return {
            "filename": filename,
            "filepath": filepath,
            "sensor": "THERMAL",
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "captured_at": datetime.now(timezone.utc).isoformat()
        }
