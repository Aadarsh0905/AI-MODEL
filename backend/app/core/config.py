import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Real-Time Earth Observation System"
    
    # JWT & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_cryptographic_key_for_phd_thesis_2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://eos_user:eos_password_secure@localhost:5432/eos_db")
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    
    # Storage paths
    STORAGE_DIR: str = os.getenv(
        "STORAGE_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage"))
    )
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        case_sensitive = True

settings = Settings()

# Create storage subdirectories
for sub in ["images", "rasters", "models", "reports"]:
    os.makedirs(os.path.join(settings.STORAGE_DIR, sub), exist_ok=True)
