from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List, Tuple, Dict
import os
import json

from app.core.database import get_db
from app.core.config import settings
from app.api import deps
from app.models.models import Raster, ChangeDetection, User
from app.services.gis_analytics import GISAnalyticsService

router = APIRouter()

@router.post("/change-detection/dem")
def detect_elevation_changes(
    base_raster_id: int,
    compare_raster_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Run DEM of Difference (DoD) change detection.
    Computes volumetric erosion and sedimentation balances.
    """
    r1 = db.query(Raster).filter(Raster.id == base_raster_id, Raster.raster_type == "DEM").first()
    r2 = db.query(Raster).filter(Raster.id == compare_raster_id, Raster.raster_type == "DEM").first()

    if not r1 or not r2:
        raise HTTPException(
            status_code=404,
            detail="DEM rasters matching requested IDs not found."
        )

    out_dod_path = os.path.join(
        settings.STORAGE_DIR, "rasters",
        f"dod_{base_raster_id}_{compare_raster_id}.tif"
    )

    try:
        results = GISAnalyticsService.calculate_dem_difference_dod(
            dem_path1=r1.file_path,
            dem_path2=r2.file_path,
            output_dod_path=out_dod_path
        )

        db_change = ChangeDetection(
            project_id=r1.project_id,
            base_raster_id=base_raster_id,
            compare_raster_id=compare_raster_id,
            change_type="ELEVATION",
            result_raster_path=out_dod_path,
            stats=json.dumps(results)
        )
        db.add(db_change)
        db.commit()
        db.refresh(db_change)

        return {
            "change_detection_id": db_change.id,
            "metrics": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing DEM change analysis: {str(e)}"
        )

@router.post("/change-detection/ndvi")
def detect_vegetation_changes(
    base_raster_id: int,
    compare_raster_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Run Multispectral NDVI change detection.
    """
    r1 = db.query(Raster).filter(Raster.id == base_raster_id, Raster.raster_type == "MULTISPECTRAL").first()
    r2 = db.query(Raster).filter(Raster.id == compare_raster_id, Raster.raster_type == "MULTISPECTRAL").first()

    if not r1 or not r2:
        raise HTTPException(
            status_code=404,
            detail="Multispectral rasters matching requested IDs not found."
        )

    out_ndvi_path = os.path.join(
        settings.STORAGE_DIR, "rasters",
        f"ndvi_change_{base_raster_id}_{compare_raster_id}.tif"
    )

    try:
        results = GISAnalyticsService.calculate_ndvi_change(
            ms_path1=r1.file_path,
            ms_path2=r2.file_path,
            output_ndvi_path=out_ndvi_path
        )

        db_change = ChangeDetection(
            project_id=r1.project_id,
            base_raster_id=base_raster_id,
            compare_raster_id=compare_raster_id,
            change_type="VEGETATION",
            result_raster_path=out_ndvi_path,
            stats=json.dumps(results)
        )
        db.add(db_change)
        db.commit()
        db.refresh(db_change)

        return {
            "change_detection_id": db_change.id,
            "metrics": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing NDVI change analysis: {str(e)}"
        )

@router.post("/gis/buffer")
def generate_vector_buffer(
    wkt: str,
    distance_deg: float,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Create buffered safety perimeter setbacks around geomorphic features.
    """
    try:
        buffered_wkt = GISAnalyticsService.vector_buffer(wkt, distance_deg)
        return {"buffered_wkt": buffered_wkt}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {str(e)}")

@router.post("/gis/interpolate")
def interpolate_field_points(
    points: List[Tuple[float, float, float]], # lon, lat, value
    bbox: Dict[str, float],
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Interpolate spatial soil erosion pegs or weather station logs using IDW.
    """
    try:
        grid = GISAnalyticsService.inverse_distance_weighting(points, bbox)
        return {"interpolated_grid": grid.tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interpolation error: {str(e)}")
