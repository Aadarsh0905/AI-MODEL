import os
import cv2
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from typing import Dict, Any, List

class ImageProcessingService:
    @staticmethod
    def lens_and_noise_correction(
        image_path: str,
        output_path: str,
        camera_matrix: np.ndarray = None,
        dist_coeffs: np.ndarray = None
    ) -> str:
        """
        Applies lens radial/tangential distortion correction using OpenCV,
        followed by bilateral filtering for edge-preserving noise removal.
        """
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Image not found at {image_path}")

        # Set default generic camera matrix and distortion coefficients if None
        if camera_matrix is None:
            # 35mm focal equivalent camera matrix
            h, w = img.shape[:2]
            focal_length = w * 0.8
            camera_matrix = np.array([
                [focal_length, 0.0, w / 2.0],
                [0.0, focal_length, h / 2.0],
                [0.0, 0.0, 1.0]
            ], dtype=np.float32)
        if dist_coeffs is None:
            # Generic slight barrel distortion
            dist_coeffs = np.array([-0.15, 0.03, 0.0, 0.0, 0.0], dtype=np.float32)

        # 1. Lens correction (undistort)
        undistorted = cv2.undistort(img, camera_matrix, dist_coeffs)

        # 2. Noise removal (Bilateral filter to preserve geomorphic edges)
        denoised = cv2.bilateralFilter(undistorted, d=9, sigmaColor=75, sigmaSpace=75)

        # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization) for enhancement
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl,a,b))
        enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

        cv2.imwrite(output_path, enhanced)
        return output_path

    @staticmethod
    def generate_photogrammetry_products(
        image_paths: List[str],
        output_dir: str,
        bbox: Dict[str, float]  # {'min_lat': float, 'min_lon': float, 'max_lat': float, 'max_lon': float}
    ) -> Dict[str, str]:
        """
        Simulates photogrammetric reconstruction (SfM).
        Writes geotiff products (Orthomosaic, DEM, DSM) referencing the boundary.
        Uses Rasterio to write correct spatial coordinate transformation (EPSG:4326).
        """
        os.makedirs(output_dir, exist_ok=True)
        
        ortho_path = os.path.join(output_dir, "orthomosaic.tif")
        dem_path = os.path.join(output_dir, "dem.tif")
        dsm_path = os.path.join(output_dir, "dsm.tif")

        width = 500
        height = 500

        # Create geo-transform matrix using bounding box coordinates
        transform = from_bounds(
            bbox["min_lon"], bbox["min_lat"],
            bbox["max_lon"], bbox["max_lat"],
            width, height
        )

        # Generate synthetic orthomosaic (multi-band RGB image with river geomorphic features)
        y_indices, x_indices = np.ogrid[:height, :width]
        river_centers = (width / 2.0 + 100.0 * np.sin(2.0 * np.pi * y_indices / height)).astype(np.int32)
        dist_to_river = np.abs(x_indices - river_centers)

        ortho_data = np.zeros((3, height, width), dtype=np.uint8)
        
        # Soil (Brownish Red) - default
        ortho_data[0, :, :] = 160
        ortho_data[1, :, :] = 120
        ortho_data[2, :, :] = 90
        
        # Riparian zone (Vegetation Green) where 30 <= dist < 60
        riparian_mask = (dist_to_river >= 30) & (dist_to_river < 60)
        ortho_data[0, riparian_mask] = 40
        ortho_data[1, riparian_mask] = 180
        ortho_data[2, riparian_mask] = 40
        
        # Water (Deep Blue) where dist < 30
        water_mask = dist_to_river < 30
        ortho_data[0, water_mask] = 10
        ortho_data[1, water_mask] = 50
        ortho_data[2, water_mask] = 220

        # Save Orthomosaic TIF
        with rasterio.open(
            ortho_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=3,
            dtype=rasterio.uint8,
            crs='+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs',
            transform=transform,
        ) as dst:
            dst.write(ortho_data)

        # Generate synthetic DEM (Digital Elevation Model with central river valley and high hills)
        elevation = 100.0 + (dist_to_river * 0.5) - (y_indices * 0.05) + (5.0 * np.sin(x_indices / 20.0))
        dem_data = np.maximum(0.0, elevation).astype(np.float32)

        # Save DEM TIF
        with rasterio.open(
            dem_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=1,
            dtype=rasterio.float32,
            crs='+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs',
            transform=transform,
        ) as dst:
            dst.write(dem_data, 1)

        # Generate synthetic DSM (Digital Surface Model including trees/buildings added on top of DEM)
        dsm_data = np.copy(dem_data)
        # Add random high tree/vegetation clusters near the riverbank
        for y in range(0, height, 15):
            for x in range(0, width, 15):
                river_center = int(width / 2.0 + 100.0 * np.sin(2.0 * np.pi * y / height))
                dist_to_river = abs(x - river_center)
                if 30 <= dist_to_river < 60: # Riparian belt
                    tree_height = float(np.random.uniform(5.0, 12.0))
                    y_min, y_max = max(0, y-4), min(height, y+4)
                    x_min, x_max = max(0, x-4), min(width, x+4)
                    dsm_data[y_min:y_max, x_min:x_max] += tree_height

        # Save DSM TIF
        with rasterio.open(
            dsm_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=1,
            dtype=rasterio.float32,
            crs='+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs',
            transform=transform,
        ) as dst:
            dst.write(dsm_data, 1)

        # Generate PNG previews for web browser viewing
        try:
            # 1. Orthomosaic BGR preview
            ortho_bgr = cv2.cvtColor(np.transpose(ortho_data, (1, 2, 0)), cv2.COLOR_RGB2BGR)
            cv2.imwrite(os.path.join(output_dir, "orthomosaic_preview.png"), ortho_bgr)

            # 2. DEM Colormap terrain preview (Using JET as TERRAIN is not standard in cv2)
            dem_min, dem_max = dem_data.min(), dem_data.max()
            if dem_max > dem_min:
                dem_norm = ((dem_data - dem_min) / (dem_max - dem_min) * 255.0).astype(np.uint8)
            else:
                dem_norm = np.zeros_like(dem_data, dtype=np.uint8)
            dem_colored = cv2.applyColorMap(dem_norm, cv2.COLORMAP_JET)
            cv2.imwrite(os.path.join(output_dir, "dem_preview.png"), dem_colored)

            # 3. DSM Colormap viridis preview
            dsm_min, dsm_max = dsm_data.min(), dsm_data.max()
            if dsm_max > dsm_min:
                dsm_norm = ((dsm_data - dsm_min) / (dsm_max - dsm_min) * 255.0).astype(np.uint8)
            else:
                dsm_norm = np.zeros_like(dsm_data, dtype=np.uint8)
            dsm_colored = cv2.applyColorMap(dsm_norm, cv2.COLORMAP_VIRIDIS)
            cv2.imwrite(os.path.join(output_dir, "dsm_preview.png"), dsm_colored)
        except Exception as e:
            import traceback
            traceback.print_exc()

        return {
            "orthomosaic": ortho_path,
            "dem": dem_path,
            "dsm": dsm_path
        }
