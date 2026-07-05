from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.models import User

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.missions import router as missions_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.photogrammetry import router as photogrammetry_router
from app.api.v1.terrain import router as terrain_router
from app.api.v1.ai import router as ai_router
from app.api.v1.gis import router as gis_router
from app.api.v1.reporting import router as reporting_router

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Seed initial admin user if none exists
db = SessionLocal()
try:
    admin = db.query(User).filter(User.email == "admin@eos.org").first()
    if not admin:
        default_admin = User(
            email="admin@eos.org",
            hashed_password=get_password_hash("admin123"),
            full_name="Dr. Jane Doe (Principal Investigator)",
            role="ADMIN",
            is_active=True
        )
        db.add(default_admin)
        db.commit()
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs"
)

# CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static files for download assets
app.mount("/static", StaticFiles(directory=settings.STORAGE_DIR), name="static")

# Include routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(projects_router, prefix=f"{settings.API_V1_STR}/projects", tags=["Projects"])
app.include_router(missions_router, prefix=f"{settings.API_V1_STR}/missions", tags=["Missions"])
app.include_router(telemetry_router, prefix=f"{settings.API_V1_STR}/telemetry", tags=["Telemetry"])
app.include_router(photogrammetry_router, prefix=f"{settings.API_V1_STR}/photogrammetry", tags=["Photogrammetry"])
app.include_router(terrain_router, prefix=f"{settings.API_V1_STR}/terrain", tags=["Terrain Analysis"])
app.include_router(ai_router, prefix=f"{settings.API_V1_STR}/ai", tags=["AI Engine & Validation"])
app.include_router(gis_router, prefix=f"{settings.API_V1_STR}/gis", tags=["GIS & Change Detection"])
app.include_router(reporting_router, prefix=f"{settings.API_V1_STR}/reporting", tags=["Reporting & Warnings"])

@app.get("/")
def root_endpoint():
    return {
        "status": "online",
        "system": "Autonomous Earth Observation Platform API v1",
        "documentation": f"{settings.API_V1_STR}/docs"
    }
