import numpy as np
import rasterio
import math
from shapely.wkt import loads, dumps
from shapely.geometry import Polygon, MultiPolygon
from typing import Dict, Any, List, Tuple

class GISAnalyticsService:
    @staticmethod
    def calculate_dem_difference_dod(
        dem_path1: str,
        dem_path2: str,
        output_dod_path: str,
        min_threshold_m: float = 0.15 # Level of Detection threshold to account for survey noise
    ) -> Dict[str, Any]:
        """
        Performs DEM of Difference (DoD) analysis: DEM2 - DEM1.
        Calculates total volume of erosion (loss) and deposition (gain) in cubic meters.
        """
        with rasterio.open(dem_path1) as src1:
            dem1 = src1.read(1)
            transform = src1.transform
            crs = src1.crs
            meta = src1.meta

        with rasterio.open(dem_path2) as src2:
            dem2 = src2.read(1)

        # Check dimension matching
        if dem1.shape != dem2.shape:
            # Resize dem2 to match dem1
            import cv2
            dem2 = cv2.resize(dem2, (dem1.shape[1], dem1.shape[0]))

        # Calculate difference (DoD)
        dod = dem2 - dem1

        # Pixel dimensions in meters
        res_x = abs(transform[0])
        res_y = abs(transform[4])
        # Grid area in sqm
        pixel_area = res_x * res_y

        # Separate erosion and deposition using Level of Detection (LoD) threshold
        erosion_mask = dod <= -min_threshold_m
        deposition_mask = dod >= min_threshold_m

        erosion_depths = dod[erosion_mask]
        deposition_depths = dod[deposition_mask]

        # Calculate volumes (V = Depth * Area)
        total_erosion_vol = float(np.sum(np.abs(erosion_depths)) * pixel_area)
        total_deposition_vol = float(np.sum(deposition_depths) * pixel_area)
        net_volume_change = total_deposition_vol - total_erosion_vol

        # Write result DoD GeoTIFF
        meta.update(dtype=rasterio.float32, count=1)
        with rasterio.open(output_dod_path, 'w', **meta) as dst:
            dst.write(dod.astype(np.float32), 1)

        return {
            "result_raster_path": output_dod_path,
            "total_erosion_volume_m3": round(total_erosion_vol, 2),
            "total_deposition_volume_m3": round(total_deposition_vol, 2),
            "net_volume_change_m3": round(net_volume_change, 2),
            "max_erosion_depth_m": float(np.min(dod)) if len(erosion_depths) > 0 else 0.0,
            "max_deposition_depth_m": float(np.max(dod)) if len(deposition_depths) > 0 else 0.0
        }

    @staticmethod
    def calculate_ndvi_change(
        ms_path1: str,
        ms_path2: str,
        output_ndvi_path: str
    ) -> Dict[str, Any]:
        """
        Computes NDVI for multispectral images from two times and detects changes.
        NDVI = (NIR - Red) / (NIR + Red)
        NIR is assumed band 3, Red is band 1.
        """
        def get_ndvi(filepath: str) -> np.ndarray:
            with rasterio.open(filepath) as src:
                # Band 1: Red, Band 3: NIR
                red = src.read(1).astype(np.float32)
                nir = src.read(3).astype(np.float32)
                
                # Prevent divide by zero
                denominator = nir + red
                denominator[denominator == 0.0] = 1e-5
                ndvi = (nir - red) / denominator
                return np.clip(ndvi, -1.0, 1.0), src.meta

        ndvi1, meta1 = get_ndvi(ms_path1)
        ndvi2, _ = get_ndvi(ms_path2)

        if ndvi1.shape != ndvi2.shape:
            import cv2
            ndvi2 = cv2.resize(ndvi2, (ndvi1.shape[1], ndvi1.shape[0]))

        # Calculate NDVI change
        ndvi_change = ndvi2 - ndvi1

        # Classify vegetation dynamics
        veggie_loss = np.sum(ndvi_change <= -0.2)
        veggie_gain = np.sum(ndvi_change >= 0.2)
        total_cells = ndvi_change.size

        # Write change TIF
        meta1.update(dtype=rasterio.float32, count=1)
        with rasterio.open(output_ndvi_path, 'w', **meta1) as dst:
            dst.write(ndvi_change.astype(np.float32), 1)

        return {
            "result_raster_path": output_ndvi_path,
            "vegetation_loss_percentage": round((veggie_loss / total_cells) * 100.0, 2),
            "vegetation_gain_percentage": round((veggie_gain / total_cells) * 100.0, 2),
            "mean_ndvi_shift": float(np.mean(ndvi_change))
        }

    @staticmethod
    def spatial_overlay_intersection(wkt1: str, wkt2: str) -> Dict[str, Any]:
        """
        GIS Vector Intersection analysis. Returns WKT intersection shape and matching area.
        """
        geom1 = loads(wkt1)
        geom2 = loads(wkt2)
        
        if not geom1.is_valid:
            geom1 = geom1.buffer(0)
        if not geom2.is_valid:
            geom2 = geom2.buffer(0)

        intersection = geom1.intersection(geom2)
        return {
            "geom_wkt": intersection.wkt,
            "area_sq_degrees": intersection.area,
            "intersects": not intersection.is_empty
        }

    @staticmethod
    def vector_buffer(wkt: str, distance_deg: float) -> str:
        """
        Applies buffering around a vector geometry. Useful for hazard setbacks.
        """
        geom = loads(wkt)
        if not geom.is_valid:
            geom = geom.buffer(0)
        buffered = geom.buffer(distance_deg)
        return buffered.wkt

    @staticmethod
    def inverse_distance_weighting(
        points: List[Tuple[float, float, float]], # List of (lon, lat, value)
        bbox: Dict[str, float],
        grid_resolution: int = 100
    ) -> np.ndarray:
        """
        GIS Spatial Interpolation (IDW algorithm) to generate a continuous
        surface grid from sparse sample measurements (e.g. soil erosion stakes).
        """
        min_lon, max_lon = bbox["min_lon"], bbox["max_lon"]
        min_lat, max_lat = bbox["min_lat"], bbox["max_lat"]

        lons = np.linspace(min_lon, max_lon, grid_resolution)
        lats = np.linspace(min_lat, max_lat, grid_resolution)
        grid_lon, grid_lat = np.meshgrid(lons, lats)
        grid_val = np.zeros_like(grid_lon)

        for r in range(grid_resolution):
            for c in range(grid_resolution):
                target_lon = grid_lon[r, c]
                target_lat = grid_lat[r, c]

                weights = []
                vals = []
                exact_match = False

                for pt_lon, pt_lat, val in points:
                    dist = math.sqrt((target_lon - pt_lon)**2 + (target_lat - pt_lat)**2)
                    if dist < 1e-7:
                        grid_val[r, c] = val
                        exact_match = True
                        break
                    
                    # Weight = 1 / d^2
                    weight = 1.0 / (dist ** 2)
                    weights.append(weight)
                    vals.append(val)

                if not exact_match and weights:
                    grid_val[r, c] = np.sum(np.array(vals) * np.array(weights)) / np.sum(weights)

        return grid_val
