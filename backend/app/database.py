"""SQLite database layer with SQLAlchemy async support."""

from datetime import datetime, timedelta
from typing import AsyncGenerator

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, JSON, func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from .config import get_settings

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


class DeviceModel(Base):
    """SQLAlchemy model for detected devices."""

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model = Column(String(100), nullable=False)
    device_id = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=True)
    channel = Column(Integer, nullable=True)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reading_count = Column(Integer, default=0)
    battery_ok = Column(Boolean, nullable=True)
    enabled = Column(Boolean, default=True)


class ReadingModel(Base):
    """SQLAlchemy model for sensor readings."""

    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    time = Column(DateTime, default=datetime.utcnow, index=True)
    device_id = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False)
    channel = Column(Integer, nullable=True)
    battery_ok = Column(Integer, nullable=True)
    temperature_C = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    pressure_hPa = Column(Float, nullable=True)
    wind_avg_km_h = Column(Float, nullable=True)
    wind_max_km_h = Column(Float, nullable=True)
    wind_dir_deg = Column(Float, nullable=True)
    rain_mm = Column(Float, nullable=True)
    raw_data = Column(JSON, nullable=True)


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for dependency injection."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


class DatabaseManager:
    """Database operations manager."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_reading(self, reading_data: dict) -> ReadingModel:
        """Save a sensor reading to the database."""
        # Generate device_id from model and id
        device_id = self._generate_device_id(reading_data)

        # Create reading
        reading = ReadingModel(
            time=reading_data.get("time", datetime.utcnow()),
            device_id=device_id,
            model=reading_data.get("model", "Unknown"),
            channel=reading_data.get("channel"),
            battery_ok=reading_data.get("battery_ok"),
            temperature_C=reading_data.get("temperature_C"),
            humidity=reading_data.get("humidity"),
            pressure_hPa=reading_data.get("pressure_hPa"),
            wind_avg_km_h=reading_data.get("wind_avg_km_h"),
            wind_max_km_h=reading_data.get("wind_max_km_h"),
            wind_dir_deg=reading_data.get("wind_dir_deg"),
            rain_mm=reading_data.get("rain_mm"),
            raw_data=reading_data,
        )

        self.session.add(reading)
        await self.session.flush()

        # Update or create device
        await self._update_device(reading_data, device_id)

        return reading

    async def _update_device(self, reading_data: dict, device_id: str):
        """Update or create device record."""
        result = await self.session.execute(
            select(DeviceModel).where(DeviceModel.device_id == device_id)
        )
        device = result.scalar_one_or_none()

        if device:
            device.last_seen = datetime.utcnow()
            device.reading_count += 1
            if "battery_ok" in reading_data:
                device.battery_ok = bool(reading_data["battery_ok"])
        else:
            device = DeviceModel(
                model=reading_data.get("model", "Unknown"),
                device_id=device_id,
                channel=reading_data.get("channel"),
                battery_ok=reading_data.get("battery_ok"),
            )
            self.session.add(device)

    def _generate_device_id(self, data: dict) -> str:
        """Generate a unique device ID from reading data."""
        model = data.get("model", "Unknown")
        sensor_id = data.get("id", "0")
        channel = data.get("channel", "")

        if channel:
            return f"{model}_{sensor_id}_{channel}"
        return f"{model}_{sensor_id}"

    async def get_devices(self, enabled_only: bool = False) -> list[DeviceModel]:
        """Get all devices."""
        query = select(DeviceModel).order_by(DeviceModel.last_seen.desc())
        if enabled_only:
            query = query.where(DeviceModel.enabled == True)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_device(self, device_id: str) -> DeviceModel | None:
        """Get a device by ID."""
        result = await self.session.execute(
            select(DeviceModel).where(DeviceModel.device_id == device_id)
        )
        return result.scalar_one_or_none()

    async def update_device(self, device_id: str, name: str = None, enabled: bool = None) -> DeviceModel | None:
        """Update device settings."""
        device = await self.get_device(device_id)
        if device:
            if name is not None:
                device.name = name
            if enabled is not None:
                device.enabled = enabled
            await self.session.flush()
        return device

    async def get_readings(
        self,
        device_id: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100,
    ) -> list[ReadingModel]:
        """Get sensor readings with optional filters."""
        query = select(ReadingModel).order_by(ReadingModel.time.desc()).limit(limit)

        if device_id:
            query = query.where(ReadingModel.device_id == device_id)
        if start_time:
            query = query.where(ReadingModel.time >= start_time)
        if end_time:
            query = query.where(ReadingModel.time <= end_time)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_latest_reading(self, device_id: str) -> ReadingModel | None:
        """Get the most recent reading for a device."""
        result = await self.session.execute(
            select(ReadingModel)
            .where(ReadingModel.device_id == device_id)
            .order_by(ReadingModel.time.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_stats(self) -> dict:
        """Get database statistics."""
        device_count = await self.session.execute(
            select(func.count()).select_from(DeviceModel)
        )
        reading_count = await self.session.execute(
            select(func.count()).select_from(ReadingModel)
        )
        last_reading = await self.session.execute(
            select(ReadingModel.time).order_by(ReadingModel.time.desc()).limit(1)
        )

        return {
            "device_count": device_count.scalar() or 0,
            "reading_count": reading_count.scalar() or 0,
            "last_reading": last_reading.scalar_one_or_none(),
        }

    async def cleanup_old_readings(self, days: int = 30):
        """Remove readings older than specified days."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        await self.session.execute(
            ReadingModel.__table__.delete().where(ReadingModel.time < cutoff)
        )
