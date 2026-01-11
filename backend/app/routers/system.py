"""System status and control API endpoints."""

import time
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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


@router.get("/rtl433/status")
async def get_rtl433_status():
    """Get rtl_433 process status."""
    return {
        "running": rtl_manager.is_running,
        "pid": rtl_manager.process.pid if rtl_manager.process else None,
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


@router.get("/logs")
async def get_logs(
    log_type: str = Query("rtl_433", description="Log type: rtl_433, backend, all"),
    lines: int = Query(100, ge=1, le=1000, description="Number of lines to return"),
    search: Optional[str] = Query(None, description="Search filter"),
):
    """Get log file contents."""
    logs_dir = settings.data_dir / "logs"
    result = []

    log_files = {
        "rtl_433": logs_dir / "rtl_433.log",
        "backend": logs_dir / "backend.log",
        "dashboard": logs_dir / "dashboard.log",
        "analyzer": logs_dir / "analyzer.log",
    }

    files_to_read = [log_type] if log_type != "all" else list(log_files.keys())

    for log_name in files_to_read:
        if log_name not in log_files:
            continue

        log_file = log_files[log_name]
        if not log_file.exists():
            continue

        try:
            with open(log_file, "r") as f:
                file_lines = f.readlines()

            # Get last N lines
            file_lines = file_lines[-lines:]

            for line in file_lines:
                line = line.strip()
                if not line:
                    continue

                # Apply search filter
                if search and search.lower() not in line.lower():
                    continue

                # Parse JSON if it looks like rtl_433 output
                entry = {
                    "source": log_name,
                    "raw": line,
                    "timestamp": None,
                    "level": "info",
                    "is_json": False,
                }

                # Try to detect log level
                line_lower = line.lower()
                if "error" in line_lower:
                    entry["level"] = "error"
                elif "warning" in line_lower or "warn" in line_lower:
                    entry["level"] = "warning"
                elif "debug" in line_lower:
                    entry["level"] = "debug"

                # Check if it's JSON (rtl_433 signal data)
                if line.startswith("{"):
                    entry["is_json"] = True
                    entry["level"] = "signal"

                result.append(entry)

        except Exception as e:
            result.append({
                "source": log_name,
                "raw": f"Error reading log: {e}",
                "level": "error",
                "is_json": False,
            })

    return {
        "logs": result[-lines:],  # Ensure we don't exceed requested lines
        "count": len(result),
        "sources": files_to_read,
    }


@router.get("/logs/files")
async def list_log_files():
    """List available log files."""
    logs_dir = settings.data_dir / "logs"
    files = []

    if logs_dir.exists():
        for f in logs_dir.iterdir():
            if f.is_file() and f.suffix == ".log":
                stat = f.stat()
                files.append({
                    "name": f.stem,
                    "filename": f.name,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })

    return {"files": files, "count": len(files)}


@router.delete("/logs/{log_name}")
async def clear_log(log_name: str):
    """Clear a specific log file."""
    logs_dir = settings.data_dir / "logs"
    log_file = logs_dir / f"{log_name}.log"

    if not log_file.exists():
        return {"status": "error", "message": f"Log file {log_name} not found"}

    try:
        with open(log_file, "w") as f:
            f.write("")
        return {"status": "success", "message": f"Cleared {log_name}.log"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
