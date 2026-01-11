"""Sensor readings API endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session, DatabaseManager
from ..models import SensorReading, SensorHistory

router = APIRouter(prefix="/sensors", tags=["sensors"])


@router.get("/", response_model=list[SensorReading])
async def get_readings(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum readings"),
    session: AsyncSession = Depends(get_session),
):
    """Get sensor readings with optional filtering."""
    db = DatabaseManager(session)

    start_time = datetime.utcnow() - timedelta(hours=hours)
    readings = await db.get_readings(
        device_id=device_id,
        start_time=start_time,
        limit=limit,
    )

    return [
        SensorReading(
            time=r.time,
            model=r.model,
            id=r.device_id,
            channel=r.channel,
            battery_ok=r.battery_ok,
            temperature_C=r.temperature_C,
            humidity=r.humidity,
            pressure_hPa=r.pressure_hPa,
            wind_avg_km_h=r.wind_avg_km_h,
            wind_max_km_h=r.wind_max_km_h,
            wind_dir_deg=r.wind_dir_deg,
            rain_mm=r.rain_mm,
            raw_data=r.raw_data or {},
        )
        for r in readings
    ]


@router.get("/latest", response_model=dict[str, SensorReading])
async def get_latest_readings(
    session: AsyncSession = Depends(get_session),
):
    """Get the latest reading for each device."""
    db = DatabaseManager(session)
    devices = await db.get_devices(enabled_only=True)

    result = {}
    for device in devices:
        reading = await db.get_latest_reading(device.device_id)
        if reading:
            result[device.device_id] = SensorReading(
                time=reading.time,
                model=reading.model,
                id=reading.device_id,
                channel=reading.channel,
                battery_ok=reading.battery_ok,
                temperature_C=reading.temperature_C,
                humidity=reading.humidity,
                pressure_hPa=reading.pressure_hPa,
                wind_avg_km_h=reading.wind_avg_km_h,
                wind_max_km_h=reading.wind_max_km_h,
                wind_dir_deg=reading.wind_dir_deg,
                rain_mm=reading.rain_mm,
                raw_data=reading.raw_data or {},
            )

    return result


@router.get("/history/{device_id}", response_model=SensorHistory)
async def get_device_history(
    device_id: str,
    hours: int = Query(24, ge=1, le=168, description="Hours of history"),
    session: AsyncSession = Depends(get_session),
):
    """Get historical readings for a specific device."""
    db = DatabaseManager(session)

    # Check device exists
    device = await db.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)

    readings = await db.get_readings(
        device_id=device_id,
        start_time=start_time,
        end_time=end_time,
        limit=1000,
    )

    return SensorHistory(
        device_id=device_id,
        readings=[
            SensorReading(
                time=r.time,
                model=r.model,
                id=r.device_id,
                channel=r.channel,
                battery_ok=r.battery_ok,
                temperature_C=r.temperature_C,
                humidity=r.humidity,
                pressure_hPa=r.pressure_hPa,
                wind_avg_km_h=r.wind_avg_km_h,
                wind_max_km_h=r.wind_max_km_h,
                wind_dir_deg=r.wind_dir_deg,
                rain_mm=r.rain_mm,
                raw_data=r.raw_data or {},
            )
            for r in readings
        ],
        start_time=start_time,
        end_time=end_time,
        count=len(readings),
    )
