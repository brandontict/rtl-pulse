"""Application configuration using Pydantic settings."""

from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "RTL-SDR Dashboard"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Paths
    project_dir: Path = Path(__file__).parent.parent.parent
    data_dir: Path = project_dir / "data"
    rtl433_bin: Path = project_dir / "rtl_433" / "build" / "src" / "rtl_433"
    rtl433_conf: Path = project_dir / "config" / "rtl_433.conf"

    # Database
    database_url: str = f"sqlite+aiosqlite:///{project_dir / 'data' / 'sensors.db'}"

    # MQTT
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_client_id: str = "rtl-sdr-dashboard"
    mqtt_topic_prefix: str = "rtl_433"

    # Home Assistant MQTT Discovery
    ha_discovery_prefix: str = "homeassistant"
    ha_device_name: str = "RTL-SDR Gateway"

    # WebSocket
    ws_heartbeat_interval: int = 30

    # RTL-433
    rtl433_frequency: str = "433.92M"
    rtl433_sample_rate: str = "1024k"
    rtl433_gain: int = 40

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create data directory if it doesn't exist
settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
