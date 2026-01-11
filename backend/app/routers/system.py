"""System status and control API endpoints."""

import time
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_session, DatabaseManager
from ..rtl_manager import rtl_manager
from ..mqtt_client import mqtt_client
from ..websocket import ws_manager
from ..models import SystemStatus

router = APIRouter(prefix="/system", tags=["system"])

# Track start time
_start_time = time.time()
settings = get_settings()


@router.get("/status", response_model=SystemStatus)
async def get_status(
    session: AsyncSession = Depends(get_session),
):
    """Get overall system status."""
    db = DatabaseManager(session)
    stats = await db.get_stats()

    return SystemStatus(
        rtl433_running=rtl_manager.is_running,
        mqtt_connected=mqtt_client.connected,
        active_devices=stats["device_count"],
        total_readings=stats["reading_count"],
        uptime_seconds=time.time() - _start_time,
        last_reading=stats["last_reading"],
    )


@router.get("/config")
async def get_config():
    """Get current configuration (non-sensitive)."""
    return {
        "rtl433": {
            "frequency": settings.rtl433_frequency,
            "sample_rate": settings.rtl433_sample_rate,
            "gain": settings.rtl433_gain,
            "binary_exists": settings.rtl433_bin.exists(),
            "config_exists": settings.rtl433_conf.exists(),
        },
        "mqtt": {
            "broker": settings.mqtt_broker,
            "port": settings.mqtt_port,
            "connected": mqtt_client.connected,
            "topic_prefix": settings.mqtt_topic_prefix,
        },
        "websocket": {
            "active_connections": ws_manager.connection_count,
        },
        "home_assistant": {
            "discovery_prefix": settings.ha_discovery_prefix,
            "device_name": settings.ha_device_name,
        },
    }


@router.post("/rtl433/start")
async def start_rtl433():
    """Start the rtl_433 process."""
    if rtl_manager.is_running:
        return {"status": "already_running", "message": "rtl_433 is already running"}

    success = await rtl_manager.start()
    if success:
        return {"status": "started", "message": "rtl_433 started successfully"}
    else:
        return {"status": "error", "message": "Failed to start rtl_433"}


@router.post("/rtl433/stop")
async def stop_rtl433():
    """Stop the rtl_433 process."""
    if not rtl_manager.is_running:
        return {"status": "not_running", "message": "rtl_433 is not running"}

    await rtl_manager.stop()
    return {"status": "stopped", "message": "rtl_433 stopped"}


@router.post("/rtl433/restart")
async def restart_rtl433():
    """Restart the rtl_433 process."""
    success = await rtl_manager.restart()
    if success:
        return {"status": "restarted", "message": "rtl_433 restarted successfully"}
    else:
        return {"status": "error", "message": "Failed to restart rtl_433"}


@router.post("/mqtt/connect")
async def connect_mqtt():
    """Connect to MQTT broker."""
    if mqtt_client.connected:
        return {"status": "already_connected", "message": "Already connected to MQTT"}

    success = await mqtt_client.connect()
    if success:
        return {"status": "connected", "message": "Connected to MQTT broker"}
    else:
        return {"status": "error", "message": "Failed to connect to MQTT broker"}


@router.post("/mqtt/disconnect")
async def disconnect_mqtt():
    """Disconnect from MQTT broker."""
    if not mqtt_client.connected:
        return {"status": "not_connected", "message": "Not connected to MQTT"}

    await mqtt_client.disconnect()
    return {"status": "disconnected", "message": "Disconnected from MQTT broker"}


@router.post("/cleanup")
async def cleanup_old_data(
    days: int = 30,
    session: AsyncSession = Depends(get_session),
):
    """Clean up old sensor readings."""
    db = DatabaseManager(session)
    await db.cleanup_old_readings(days=days)
    return {"status": "success", "message": f"Cleaned up readings older than {days} days"}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0",
    }
