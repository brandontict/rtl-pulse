"""Device management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session, DatabaseManager
from ..models import Device, DeviceCreate

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/", response_model=list[Device])
async def get_devices(
    enabled_only: bool = False,
    session: AsyncSession = Depends(get_session),
):
    """Get all detected devices."""
    db = DatabaseManager(session)
    devices = await db.get_devices(enabled_only=enabled_only)

    return [
        Device(
            model=d.model,
            device_id=d.device_id,
            name=d.name,
            channel=d.channel,
            first_seen=d.first_seen,
            last_seen=d.last_seen,
            reading_count=d.reading_count,
            battery_ok=d.battery_ok,
            enabled=d.enabled,
        )
        for d in devices
    ]


@router.get("/{device_id}", response_model=Device)
async def get_device(
    device_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a specific device by ID."""
    db = DatabaseManager(session)
    device = await db.get_device(device_id)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return Device(
        model=device.model,
        device_id=device.device_id,
        name=device.name,
        channel=device.channel,
        first_seen=device.first_seen,
        last_seen=device.last_seen,
        reading_count=device.reading_count,
        battery_ok=device.battery_ok,
        enabled=device.enabled,
    )


@router.patch("/{device_id}", response_model=Device)
async def update_device(
    device_id: str,
    data: DeviceCreate,
    session: AsyncSession = Depends(get_session),
):
    """Update device settings (name, enabled status)."""
    db = DatabaseManager(session)
    device = await db.update_device(
        device_id=device_id,
        name=data.name,
        enabled=data.enabled,
    )

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return Device(
        model=device.model,
        device_id=device.device_id,
        name=device.name,
        channel=device.channel,
        first_seen=device.first_seen,
        last_seen=device.last_seen,
        reading_count=device.reading_count,
        battery_ok=device.battery_ok,
        enabled=device.enabled,
    )


@router.delete("/{device_id}")
async def disable_device(
    device_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Disable a device (soft delete)."""
    db = DatabaseManager(session)
    device = await db.update_device(device_id=device_id, enabled=False)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return {"message": f"Device {device_id} disabled"}
