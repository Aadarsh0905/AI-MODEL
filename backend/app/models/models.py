from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="RESEARCHER") # ADMIN, RESEARCHER, GIS_ANALYST, FIELD_ENGINEER, ENVIRONMENTAL_OFFICER
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    missions = relationship("Mission", back_populates="project", cascade="all, delete-orphan")
    rasters = relationship("Raster", back_populates="project", cascade="all, delete-orphan")
    change_detections = relationship("ChangeDetection", back_populates="project", cascade="all, delete-orphan")

class Mission(Base):
    __tablename__ = "missions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    status = Column(String(50), default="PLANNED") # PLANNED, ACTIVE, COMPLETED, CANCELLED
    weather_info = Column(String, nullable=True) # JSON stored as string
    battery_estimated_percentage = Column(Numeric(5, 2), nullable=True)
    battery_used_percentage = Column(Numeric(5, 2), nullable=True)
    flight_path = Column(String, nullable=True) # WKT LineString representation
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="missions")
    waypoints = relationship("Waypoint", back_populates="mission", cascade="all, delete-orphan")
    telemetry_logs = relationship("TelemetryLog", back_populates="mission", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="mission", cascade="all, delete-orphan")

class Waypoint(Base):
    __tablename__ = "waypoints"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    sequence = Column(Integer, nullable=False)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    altitude = Column(Numeric(8, 2), nullable=False)
    speed = Column(Numeric(5, 2), default=5.0)
    action = Column(String(50), default="WAYPOINT")
    status = Column(String(20), default="PENDING")
    terrain_elevation = Column(Numeric(8, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mission = relationship("Mission", back_populates="waypoints")

class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(BigInteger, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    altitude = Column(Numeric(8, 2), nullable=False)
    pitch = Column(Numeric(6, 3), nullable=False)
    roll = Column(Numeric(6, 3), nullable=False)
    yaw = Column(Numeric(6, 3), nullable=False)
    battery_voltage = Column(Numeric(5, 2), nullable=True)
    battery_percentage = Column(Numeric(5, 2), nullable=True)
    signal_strength = Column(Integer, nullable=True)
    heading = Column(Numeric(5, 2), nullable=True)
    airspeed = Column(Numeric(5, 2), nullable=True)
    groundspeed = Column(Numeric(5, 2), nullable=True)

    mission = relationship("Mission", back_populates="telemetry_logs")

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(512), nullable=False)
    sensor = Column(String(50), default="RGB") # RGB, LIDAR, MULTISPECTRAL, THERMAL
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    altitude = Column(Numeric(8, 2), nullable=False)
    yaw = Column(Numeric(6, 3), nullable=True)
    pitch = Column(Numeric(6, 3), nullable=True)
    roll = Column(Numeric(6, 3), nullable=True)
    geom = Column(String, nullable=True) # WKT Point representation
    captured_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mission = relationship("Mission", back_populates="images")
    ai_detections = relationship("AIDetection", back_populates="image", cascade="all, delete-orphan")

class Raster(Base):
    __tablename__ = "rasters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    raster_type = Column(String(50), nullable=False) # DEM, DSM, DTM, ORTHOMOSAIC, SLOPE, ASPECT, HILLSHADE, NDVI
    file_path = Column(String(512), nullable=False)
    resolution_meters = Column(Numeric(6, 3), nullable=True)
    min_val = Column(Numeric(12, 4), nullable=True)
    max_val = Column(Numeric(12, 4), nullable=True)
    bounding_box = Column(String, nullable=True) # WKT Polygon representation
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="rasters")
    ai_detections = relationship("AIDetection", back_populates="raster", cascade="all, delete-orphan")

class AIModel(Base):
    __tablename__ = "ai_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    architecture = Column(String(100), nullable=False) # UNET, YOLO, DEEPLABV3PLUS, MASKRCNN, TRANSFORMER
    file_path = Column(String(512), nullable=False)
    is_active = Column(Boolean, default=False)
    training_accuracy = Column(Numeric(5, 4), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    detections = relationship("AIDetection", back_populates="model")

class AIDetection(Base):
    __tablename__ = "ai_detections"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=True)
    raster_id = Column(Integer, ForeignKey("rasters.id", ondelete="CASCADE"), nullable=True)
    model_id = Column(Integer, ForeignKey("ai_models.id", ondelete="SET NULL"), nullable=True)
    class_name = Column(String(100), nullable=False) # River, Coastline, Landslide, Erosion, Vegetation, BareLand, etc.
    geom = Column(String, nullable=False) # WKT Geometry representation
    confidence = Column(Numeric(4, 3), nullable=False)
    area_sqm = Column(Numeric(12, 2), nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    image = relationship("Image", back_populates="ai_detections")
    raster = relationship("Raster", back_populates="ai_detections")
    model = relationship("AIModel", back_populates="detections")
    validations = relationship("Validation", back_populates="detection", cascade="all, delete-orphan")

class ChangeDetection(Base):
    __tablename__ = "change_detections"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    base_raster_id = Column(Integer, ForeignKey("rasters.id", ondelete="SET NULL"), nullable=True)
    compare_raster_id = Column(Integer, ForeignKey("rasters.id", ondelete="SET NULL"), nullable=True)
    change_type = Column(String(100), nullable=False) # ELEVATION, VEGETATION, RIVER_SHIFT, LAND_COVER, COASTAL_EROSION, SEDIMENTATION
    result_raster_path = Column(String(512), nullable=True)
    result_vector_geom = Column(String, nullable=True) # WKT Geometry representation
    stats = Column(String, nullable=True) # JSON stored as string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="change_detections")

class Validation(Base):
    __tablename__ = "validations"

    id = Column(Integer, primary_key=True, index=True)
    detection_id = Column(Integer, ForeignKey("ai_detections.id", ondelete="CASCADE"), nullable=False)
    ground_truth_geom = Column(String, nullable=False) # WKT Geometry
    metric_iou = Column(Numeric(4, 3), nullable=True)
    metric_precision = Column(Numeric(4, 3), nullable=True)
    metric_recall = Column(Numeric(4, 3), nullable=True)
    metric_f1 = Column(Numeric(4, 3), nullable=True)
    metric_accuracy = Column(Numeric(4, 3), nullable=True)
    metric_kappa = Column(Numeric(4, 3), nullable=True)
    validated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_at = Column(DateTime(timezone=True), server_default=func.now())

    detection = relationship("AIDetection", back_populates="validations")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_format = Column(String(10), nullable=False) # PDF, EXCEL, CSV
    report_type = Column(String(50), nullable=False) # MISSION, ACCURACY, CHANGE_DETECTION, HAZARD_WARNING
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PerformanceLog(Base):
    __tablename__ = "performance_logs"

    id = Column(BigInteger, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    cpu_usage_pct = Column(Numeric(5, 2), nullable=True)
    gpu_usage_pct = Column(Numeric(5, 2), nullable=True)
    gpu_memory_used_mb = Column(Integer, nullable=True)
    system_memory_used_pct = Column(Numeric(5, 2), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    inference_time_ms = Column(Integer, nullable=True)
    fps = Column(Numeric(5, 2), nullable=True)
    network_rx_kbps = Column(Numeric(10, 2), nullable=True)
    network_tx_kbps = Column(Numeric(10, 2), nullable=True)
