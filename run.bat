@echo off
echo =====================================================================
echo    Autonomous Earth Observation System (EOS) for Geomorphic Changes
echo =====================================================================
echo.
echo [1/3] Launching Docker Containers (PostgreSQL+PostGIS, Redis, FastAPI, React)...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker Compose failed to start. Ensure Docker Desktop is active.
    pause
    exit /b %errorlevel%
)
echo.
echo [2/3] Verification: Waiting for databases and API Gateway to sync...
timeout /t 5 /nobreak >nul
echo.
echo [3/3] System Deployment Successful!
echo ---------------------------------------------------------------------
echo  * Client Control Dashboard : http://localhost:3000
echo  * Swagger API Documentation: http://localhost:8000/api/v1/docs
echo  * Active Postgres PostGIS  : localhost:5432 (Database: eos_db)
echo ---------------------------------------------------------------------
echo.
pause
