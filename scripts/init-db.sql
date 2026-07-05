-- Database Initialization Script for Earth Observation System
-- Enable PostGIS and Raster extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Enum for User Roles
CREATE TYPE user_role AS ENUM ('ADMIN', 'RESEARCHER', 'GIS_ANALYST', 'FIELD_ENGINEER', 'ENVIRONMENTAL_OFFICER');

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'RESEARCHER',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enum for Mission Status
CREATE TYPE mission_status AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- Missions Table
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status mission_status NOT NULL DEFAULT 'PLANNED',
    weather_info JSONB,
    battery_estimated_percentage NUMERIC(5, 2),
    battery_used_percentage NUMERIC(5, 2),
    flight_path GEOMETRY(LineString, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Waypoints Table
CREATE TABLE IF NOT EXISTS waypoints (
    id SERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    altitude NUMERIC(8, 2) NOT NULL,
    speed NUMERIC(5, 2) DEFAULT 5.0,
    action VARCHAR(50) DEFAULT 'WAYPOINT',
    status VARCHAR(20) DEFAULT 'PENDING',
    terrain_elevation NUMERIC(8, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_mission_sequence UNIQUE (mission_id, sequence)
);

-- Telemetry Logs Table (High-frequency logs, partitioned in production)
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id BIGSERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    altitude NUMERIC(8, 2) NOT NULL,
    pitch NUMERIC(6, 3) NOT NULL,
    roll NUMERIC(6, 3) NOT NULL,
    yaw NUMERIC(6, 3) NOT NULL,
    battery_voltage NUMERIC(5, 2),
    battery_percentage NUMERIC(5, 2),
    signal_strength INTEGER,
    heading NUMERIC(5, 2),
    airspeed NUMERIC(5, 2),
    groundspeed NUMERIC(5, 2)
);

-- Spatial index on telemetry logs location
CREATE INDEX IF NOT EXISTS telemetry_geom_idx ON telemetry_logs USING gist(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- Enum for Imagery Formats
CREATE TYPE sensor_type AS ENUM ('RGB', 'LIDAR', 'MULTISPECTRAL', 'THERMAL');

-- Images Table
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(512) NOT NULL,
    sensor sensor_type NOT NULL DEFAULT 'RGB',
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    altitude NUMERIC(8, 2) NOT NULL,
    yaw NUMERIC(6, 3),
    pitch NUMERIC(6, 3),
    roll NUMERIC(6, 3),
    geom GEOMETRY(Point, 4326),
    captured_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update geometry from lat/lon
CREATE OR REPLACE FUNCTION update_image_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_image_geom
BEFORE INSERT OR UPDATE ON images
FOR EACH ROW EXECUTE FUNCTION update_image_geom();

CREATE INDEX IF NOT EXISTS images_geom_idx ON images USING gist(geom);

-- Rasters Metadata Table
CREATE TABLE IF NOT EXISTS rasters (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    raster_type VARCHAR(50) NOT NULL, -- DEM, DSM, DTM, ORTHOMOSAIC, SLOPE, ASPECT, HILLSHADE, NDVI
    file_path VARCHAR(512) NOT NULL,
    resolution_meters NUMERIC(6, 3),
    min_val NUMERIC(12, 4),
    max_val NUMERIC(12, 4),
    bounding_box GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS rasters_bbox_idx ON rasters USING gist(bounding_box);

-- AI Models Table
CREATE TABLE IF NOT EXISTS ai_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    architecture VARCHAR(100) NOT NULL, -- UNET, YOLO, DEEPLABV3PLUS, MASKRCNN, TRANSFORMER
    file_path VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    training_accuracy NUMERIC(5, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_name_version UNIQUE (name, version)
);

-- AI Detections Table (Stores georeferenced polygon and classification results)
CREATE TABLE IF NOT EXISTS ai_detections (
    id SERIAL PRIMARY KEY,
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    raster_id INTEGER REFERENCES rasters(id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES ai_models(id) ON DELETE SET NULL,
    class_name VARCHAR(100) NOT NULL, -- River, Coastline, Landslide, Erosion, Vegetation, BareLand, etc.
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    area_sqm NUMERIC(12, 2),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ai_detections_geom_idx ON ai_detections USING gist(geom);

-- Change Detections Table (Multi-temporal elevation or land cover change results)
CREATE TABLE IF NOT EXISTS change_detections (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    base_raster_id INTEGER REFERENCES rasters(id) ON DELETE SET NULL,
    compare_raster_id INTEGER REFERENCES rasters(id) ON DELETE SET NULL,
    change_type VARCHAR(100) NOT NULL, -- ELEVATION, VEGETATION, RIVER_SHIFT, LAND_COVER, COASTAL_EROSION, SEDIMENTATION
    result_raster_path VARCHAR(512),
    result_vector_geom GEOMETRY(Geometry, 4326),
    stats JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS change_detections_geom_idx ON change_detections USING gist(result_vector_geom);

-- Validations Table (Compares detections with Ground Truth)
CREATE TABLE IF NOT EXISTS validations (
    id SERIAL PRIMARY KEY,
    detection_id INTEGER REFERENCES ai_detections(id) ON DELETE CASCADE,
    ground_truth_geom GEOMETRY(Geometry, 4326) NOT NULL,
    metric_iou NUMERIC(4, 3),
    metric_precision NUMERIC(4, 3),
    metric_recall NUMERIC(4, 3),
    metric_f1 NUMERIC(4, 3),
    metric_accuracy NUMERIC(4, 3),
    metric_kappa NUMERIC(4, 3),
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_format VARCHAR(10) NOT NULL, -- PDF, EXCEL, CSV
    report_type VARCHAR(50) NOT NULL, -- MISSION, ACCURACY, CHANGE_DETECTION, HAZARD_WARNING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Performance logs
CREATE TABLE IF NOT EXISTS performance_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cpu_usage_pct NUMERIC(5, 2),
    gpu_usage_pct NUMERIC(5, 2),
    gpu_memory_used_mb INTEGER,
    system_memory_used_pct NUMERIC(5, 2),
    latency_ms INTEGER,
    inference_time_ms INTEGER,
    fps NUMERIC(5, 2),
    network_rx_kbps NUMERIC(10, 2),
    network_tx_kbps NUMERIC(10, 2)
);
