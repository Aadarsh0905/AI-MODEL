import numpy as np
import cv2
import rasterio
from typing import Dict, Any, Tuple, List

class TerrainAnalysisService:
    @staticmethod
    def calculate_slope_and_aspect(
        dem_array: np.ndarray,
        resolution: float = 1.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Computes terrain Slope (degrees) and Aspect (degrees azimuth) from DEM array
        using Sobel operators to determine directional elevation gradients.
        """
        # Sobel filters for x and y gradients
        dx = cv2.Sobel(dem_array, cv2.CV_64F, 1, 0, ksize=3) / (8.0 * resolution)
        dy = cv2.Sobel(dem_array, cv2.CV_64F, 0, 1, ksize=3) / (8.0 * resolution)

        # Slope: arctan( sqrt(dx^2 + dy^2) )
        slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
        slope_deg = np.degrees(slope_rad)

        # Aspect: direction of descent (clockwise from North 0-360)
        # aspect = 270 + arctan2(dy, -dx) (adjusted for geographical coordinates)
        aspect_rad = np.arctan2(dy, -dx)
        aspect_deg = np.degrees(aspect_rad)
        aspect_geo = (270.0 - aspect_deg) % 360.0

        return slope_deg, aspect_geo

    @staticmethod
    def calculate_hillshade(
        slope_deg: np.ndarray,
        aspect_deg: np.ndarray,
        azimuth_deg: float = 315.0,
        altitude_deg: float = 45.0
    ) -> np.ndarray:
        """
        Computes multidirectional hillshade raster showing spatial shadows.
        Formula: Hillshade = 255.0 * ( (cos(zenith)*cos(slope)) + (sin(zenith)*sin(slope)*cos(azimuth - aspect)) )
        """
        # Convert angles to radians
        zenith_rad = np.radians(90.0 - altitude_deg)
        azimuth_rad = np.radians(360.0 - azimuth_deg + 90.0) # Map to math polar system
        
        slope_rad = np.radians(slope_deg)
        aspect_rad = np.radians(aspect_deg)

        # Hillshade calculation
        hillshade = np.cos(zenith_rad) * np.cos(slope_rad) + \
                    np.sin(zenith_rad) * np.sin(slope_rad) * np.cos(azimuth_rad - aspect_rad)

        # Clip values to [0, 1] range and scale to 0-255
        hillshade = np.clip(hillshade, 0.0, 1.0)
        return (hillshade * 255.0).astype(np.uint8)

    @staticmethod
    def extract_contours(
        dem_array: np.ndarray,
        interval_meters: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        Extracts topographic contours (isolines) from elevation matrix using OpenCV contours.
        Returns a list of vector line segments with elevations.
        """
        contours_list = []
        min_val = float(np.min(dem_array))
        max_val = float(np.max(dem_array))
        
        # Determine elevations to slice
        start = int(np.ceil(min_val / interval_meters) * interval_meters)
        end = int(np.floor(max_val / interval_meters) * interval_meters)

        for elevation in range(start, end + 1, int(interval_meters)):
            # Threshold DEM at elevation boundary
            binary = (dem_array >= elevation).astype(np.uint8) * 255
            
            # Find boundaries
            contours, _ = cv2.findContours(binary, cv2.RETR_CUST_LIST if hasattr(cv2, 'RETR_CUST_LIST') else cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                if len(cnt) < 2:
                    continue
                # Format points array
                pts = cnt.squeeze(axis=1).tolist()
                contours_list.append({
                    "elevation": float(elevation),
                    "points": pts # Pixels coords (col, row)
                })
        return contours_list

    @staticmethod
    def calculate_d8_flow(
        dem_array: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Implements D8 flow direction and accumulation algorithm.
        Flow Direction:
            128  64  32
             1    x  16
             2    4   8
        """
        rows, cols = dem_array.shape
        flow_dir = np.zeros((rows, cols), dtype=np.uint8)
        flow_acc = np.ones((rows, cols), dtype=np.int32) # Base flow accumulation is 1 cell

        # Neighbor offsets clockwise starting East:
        # [E, SE, S, SW, W, NW, N, NE]
        offsets = [(0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1)]
        d8_codes = [1, 2, 4, 8, 16, 32, 64, 128]

        # Calculate slope-based directions
        for r in range(1, rows - 1):
            for c in range(1, cols - 1):
                max_slope = 0.0
                best_dir = 0
                
                curr_elev = dem_array[r, c]

                for idx, (dr, dc) in enumerate(offsets):
                    neighbor_elev = dem_array[r + dr, c + dc]
                    dist = 1.414 if abs(dr) + abs(dc) == 2 else 1.0
                    slope = (curr_elev - neighbor_elev) / dist
                    
                    if slope > max_slope:
                        max_slope = slope
                        best_dir = d8_codes[idx]
                
                flow_dir[r, c] = best_dir

        # Flow accumulation calculation (simplified D8 topological sort propagation)
        # Create coordinates lists sorted by elevation descending (highest to lowest)
        flat_indices = np.argsort(dem_array.ravel())[::-1]
        
        for idx in flat_indices:
            r = idx // cols
            c = idx % cols
            
            # Boundary bounds
            if r <= 0 or r >= rows - 1 or c <= 0 or c >= cols - 1:
                continue

            code = flow_dir[r, c]
            if code == 0:
                continue

            # Find receiving neighbor offset
            offset_idx = d8_codes.index(code)
            dr, dc = offsets[offset_idx]
            
            # Add my accumulation weight to downstream receiver
            flow_acc[r + dr, c + dc] += flow_acc[r, c]

        return flow_dir, flow_acc
