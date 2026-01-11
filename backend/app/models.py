"""Pydantic models for API request/response and data validation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    """A single sensor reading from rtl_433."""

    time: datetime
    model: str
    id: int | str | None = None
    channel: int | None = None
    battery_ok: int | None = None
    temperature_C: float | None = None
    humidity: float | None = None
    pressure_hPa: float | None = None
    wind_avg_km_h: float | None = None
    wind_max_km_h: float | None = None
    wind_dir_deg: float | None = None
    rain_mm: float | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class Device(BaseModel):
    """A detected RTL-433 device."""

    model: str
    device_id: str
    name: str | None = None
    channel: int | None = None
    first_seen: datetime
    last_seen: datetime
    reading_count: int = 0
    battery_ok: bool | None = None
    enabled: bool = True

    class Config:
        from_attributes = True


class DeviceCreate(BaseModel):
    """Request model for creating/updating a device."""

    name: str | None = None
    enabled: bool = True


class SensorHistory(BaseModel):
    """Historical sensor data for charts."""

    device_id: str
    readings: list[SensorReading]
    start_time: datetime
    end_time: datetime
    count: int


class SystemStatus(BaseModel):
    """System status information."""

    rtl433_running: bool
    mqtt_connected: bool
    active_devices: int
    total_readings: int
    uptime_seconds: float
    last_reading: datetime | None = None


class RTL433Config(BaseModel):
    """RTL-433 configuration."""

    frequency: str = "433.92M"
    sample_rate: str = "1024k"
    gain: int = 40
    protocols: list[int] = []


class WebSocketMessage(BaseModel):
    """WebSocket message format."""

    type: str  # "reading", "device", "status", "error"
    data: dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MQTTMessage(BaseModel):
    """MQTT message format for HA discovery."""

    topic: str
    payload: dict[str, Any] | str
    retain: bool = False
