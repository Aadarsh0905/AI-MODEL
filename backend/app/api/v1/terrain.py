from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any
import rasterio
import numpy as np
import os

from app.core.database import get_db
from app.api import deps
from app.models.models import Raster, User
from app.services.terrain_analysis import TerrainAnalysisService

router = APIRouter()

@router.post("/analyze/{raster_id}")
def analyze_dem_raster(
    raster_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Load a Digital Elevation Model (DEM), run Slope/Aspect/Hillshade/Flow analyses,
    generate product files using rasterio, write metadata to DB, and return stats.
    """
    dem_record = db.query(Raster).filter(Raster.id == raster_id, Raster.raster_type == "DEM").first()
    if not dem_record:
        raise HTTPException(
            status_code=404,
            detail="DEM raster record not found in system."
        )

    dem_path = dem_record.file_path
    if not os.path.exists(dem_path):
        raise HTTPException(
            status_code=400,
            detail=f"DEM file does not exist at {dem_path}."
        )

    try:
        with rasterio.open(dem_path) as dataset:
            dem_array = dataset.read(1)
            transform = dataset.transform
            crs = dataset.crs
            height, width = dataset.height, dataset.width

        # Run numpy analyses
        slope, aspect = TerrainAnalysisService.calculate_slope_and_aspect(dem_array, resolution=1.0)
        hillshade = TerrainAnalysisService.calculate_hillshade(slope, aspect)
        flow_dir, flow_acc = TerrainAnalysisService.calculate_d8_flow(dem_array)

        # Output folder
        out_dir = os.path.dirname(dem_path)
        
        slope_path = os.path.join(out_dir, "slope.tif")
        aspect_path = os.path.join(out_dir, "aspect.tif")
        hillshade_path = os.path.join(out_dir, "hillshade.tif")
        flow_acc_path = os.path.join(out_dir, "flow_accumulation.tif")

        # Save Slope GeoTIFF
        with rasterio.open(
            slope_path, 'w', driver='GTiff',
            height=height, width=width, count=1,
            dtype=rasterio.float32, crs=crs, transform=transform
        ) as dst:
            dst.write(slope.astype(np.float32), 1)

        # Save Aspect GeoTIFF
        with rasterio.open(
            aspect_path, 'w', driver='GTiff',
            height=height, width=width, count=1,
            dtype=rasterio.float32, crs=crs, transform=transform
        ) as dst:
            dst.write(aspect.astype(np.float32), 1)

        # Save Hillshade GeoTIFF
        with rasterio.open(
            hillshade_path, 'w', driver='GTiff',
            height=height, width=width, count=1,
            dtype=rasterio.uint8, crs=crs, transform=transform
        ) as dst:
            dst.write(hillshade, 1)

        # Save Flow Accumulation GeoTIFF
        with rasterio.open(
            flow_acc_path, 'w', driver='GTiff',
            height=height, width=width, count=1,
            dtype=rasterio.float32, crs=crs, transform=transform
        ) as dst:
            dst.write(flow_acc.astype(np.float32), 1)

        # Create new database records
        slope_db = Raster(
            project_id=dem_record.project_id,
            mission_id=dem_record.mission_id,
            name="Slope Analysis",
            raster_type="SLOPE",
            file_path=slope_path,
            resolution_meters=1.0,
            bounding_box=dem_record.bounding_box
        )
        aspect_db = Raster(
            project_id=dem_record.project_id,
            mission_id=dem_record.mission_id,
            name="Aspect Analysis",
            raster_type="ASPECT",
            file_path=aspect_path,
            resolution_meters=1.0,
            bounding_box=dem_record.bounding_box
        )
        hillshade_db = Raster(
            project_id=dem_record.project_id,
            mission_id=dem_record.mission_id,
            name="Hillshade Analysis",
            raster_type="HILLSHADE",
            file_path=hillshade_path,
            resolution_meters=1.0,
            bounding_box=dem_record.bounding_box
        )
        db.add_all([slope_db, aspect_db, hillshade_db])
        db.commit()

        # Extract contours
        contours = TerrainAnalysisService.extract_contours(dem_array, interval_meters=10.0)

        return {
            "status": "analysis_completed",
            "slope_stats": {
                "min": float(np.min(slope)),
                "max": float(np.max(slope)),
                "mean": float(np.mean(slope))
            },
            "elevation_stats": {
                "min": float(np.min(dem_array)),
                "max": float(np.max(dem_array)),
                "mean": float(np.mean(dem_array))
            },
            "contours_extracted": len(contours)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing terrain spatial analysis: {str(e)}"
        )
