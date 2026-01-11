"""Pydantic models for API request/response and data validation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Union, Dict, List

from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    """A single sensor reading from rtl_433."""

    time: datetime
    model: str
    id: Optional[Union[int, str]] = None
    channel: Optional[int] = None
    battery_ok: Optional[int] = None
    temperature_C: Optional[float] = None
    humidity: Optional[float] = None
    pressure_hPa: Optional[float] = None
    wind_avg_km_h: Optional[float] = None
    wind_max_km_h: Optional[float] = None
    wind_dir_deg: Optional[float] = None
    rain_mm: Optional[float] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class Device(BaseModel):
    """A detected RTL-433 device."""

    model: str
    device_id: str
    name: Optional[str] = None
    channel: Optional[int] = None
    first_seen: datetime
    last_seen: datetime
    reading_count: int = 0
    battery_ok: Optional[bool] = None
    enabled: bool = True

    class Config:
        from_attributes = True


class DeviceCreate(BaseModel):
    """Request model for creating/updating a device."""

    name: Optional[str] = None
    enabled: bool = True


class SensorHistory(BaseModel):
    """Historical sensor data for charts."""

    device_id: str
    readings: List[SensorReading]
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
    last_reading: Optional[datetime] = None


class RTL433Config(BaseModel):
    """RTL-433 configuration."""

    frequency: str = "433.92M"
    sample_rate: str = "1024k"
    gain: int = 40
    protocols: List[int] = []


class WebSocketMessage(BaseModel):
    """WebSocket message format."""

    type: str  # "reading", "device", "status", "error"
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MQTTMessage(BaseModel):
    """MQTT message format for HA discovery."""

    topic: str
    payload: Union[Dict[str, Any], str]
    retain: bool = False
