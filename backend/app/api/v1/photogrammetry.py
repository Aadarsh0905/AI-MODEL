from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any
import os

from app.core.database import get_db
from app.core.config import settings
from app.api import deps
from app.models.models import Mission, Image, Raster, User
from app.services.image_processing import ImageProcessingService

router = APIRouter()

def run_photogrammetry_background(mission_id: int, db_session_factory):
    """
    Background worker that runs image correction and constructs DSM/DEM/Orthomosaic geotiffs.
    """
    db: Session = db_session_factory()
    try:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if not mission:
            return

        images = db.query(Image).filter(Image.mission_id == mission_id).all()
        if not images:
            return

        # 1. Lens and geometric enhancement for each captured image
        corrected_paths = []
        for img in images:
            base, ext = os.path.splitext(img.filepath)
            corrected_filepath = f"{base}_corrected{ext}"
            
            try:
                ImageProcessingService.lens_and_noise_correction(
                    image_path=img.filepath,
                    output_path=corrected_filepath
                )
                img.filepath = corrected_filepath
                img.processed_at = img.captured_at
                corrected_paths.append(corrected_filepath)
            except Exception as e:
                # Fallback to uncorrected if fail
                corrected_paths.append(img.filepath)

        # Calculate bounding box from waypoints or image locations
        lats = [float(img.latitude) for img in images]
        lons = [float(img.longitude) for img in images]
        
        # Expanded padding for bbox
        bbox = {
            "min_lat": min(lats) - 0.001,
            "max_lat": max(lats) + 0.001,
            "min_lon": min(lons) - 0.001,
            "max_lon": max(lons) + 0.001
        }

        # 2. Run SfM reconstruction simulating orthomosaic, DEM, and DSM
        output_dir = os.path.join(settings.STORAGE_DIR, f"mission_{mission_id}")
        products = ImageProcessingService.generate_photogrammetry_products(
            image_paths=corrected_paths,
            output_dir=output_dir,
            bbox=bbox
        )

        wkt_bbox = f"POLYGON(({bbox['min_lon']} {bbox['min_lat']}, {bbox['max_lon']} {bbox['min_lat']}, {bbox['max_lon']} {bbox['max_lat']}, {bbox['min_lon']} {bbox['max_lat']}, {bbox['min_lon']} {bbox['min_lat']}))"

        # 3. Store rasters to database
        for r_type, f_path in products.items():
            db_raster = Raster(
                project_id=mission.project_id,
                mission_id=mission_id,
                name=f"Mission_{mission_id}_{r_type.upper()}",
                raster_type=r_type.upper(),
                file_path=f_path,
                resolution_meters=0.05,  # 5cm grid size
                bounding_box=wkt_bbox
            )
            db.add(db_raster)
        
        db.commit()

    except Exception as e:
        pass
    finally:
        db.close()

@router.post("/process-mission/{mission_id}")
def process_mission_imagery(
    mission_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Asynchronously processes images captured during the mission to construct orthomosaic and DEM layers.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    background_tasks.add_task(run_photogrammetry_background, mission_id, SessionLocal)
    return {"status": "processing_started"}
