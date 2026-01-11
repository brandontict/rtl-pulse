"""Live spectrum analyzer API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging

from ..spectrum_manager import spectrum_manager
from ..rtl_manager import rtl_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spectrum", tags=["spectrum"])


def parse_frequency(freq_str: str) -> int:
    """Parse frequency string like '433.92M' to Hz."""
    freq_str = freq_str.strip().upper()
    multipliers = {
        'K': 1_000,
        'M': 1_000_000,
        'G': 1_000_000_000,
    }

    for suffix, mult in multipliers.items():
        if freq_str.endswith(suffix):
            return int(float(freq_str[:-1]) * mult)

    return int(float(freq_str))


@router.get("/live/status")
async def get_live_status():
    """Get current status of live spectrum analyzer."""
    return spectrum_manager.get_status()


@router.post("/live/start")
async def start_live_spectrum(
    center_freq: str = Query("433.92M", description="Center frequency"),
    sample_rate: str = Query("2.048M", description="Sample rate"),
    fft_size: int = Query(1024, ge=256, le=4096, description="FFT size"),
    gain: int = Query(40, ge=0, le=50, description="Tuner gain"),
    averaging: int = Query(4, ge=1, le=16, description="FFT averaging"),
):
    """Start live spectrum analyzer."""
    # Check if rtl_433 is running
    if rtl_manager.is_running:
        raise HTTPException(
            status_code=409,
            detail="Cannot start live spectrum while rtl_433 is running. Stop it first via POST /api/v1/system/rtl433/stop"
        )

    if spectrum_manager.is_running:
        raise HTTPException(
            status_code=409,
            detail="Live spectrum already running"
        )

    # Configure spectrum manager
    spectrum_manager.configure(
        center_freq=parse_frequency(center_freq),
        sample_rate=parse_frequency(sample_rate),
        fft_size=fft_size,
        gain=gain,
        averaging=averaging,
    )

    # Start spectrum analyzer
    success = await spectrum_manager.start()
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to start spectrum analyzer. Check if rtl_sdr is installed."
        )

    return {
        "status": "started",
        "config": spectrum_manager.get_status()
    }


@router.post("/live/stop")
async def stop_live_spectrum():
    """Stop live spectrum analyzer."""
    await spectrum_manager.stop()
    return {"status": "stopped"}


@router.post("/live/configure")
async def configure_live_spectrum(
    center_freq: str = Query(None, description="Center frequency"),
    sample_rate: str = Query(None, description="Sample rate"),
    fft_size: int = Query(None, ge=256, le=4096, description="FFT size"),
    gain: int = Query(None, ge=0, le=50, description="Tuner gain"),
    averaging: int = Query(None, ge=1, le=16, description="FFT averaging"),
):
    """Update live spectrum configuration. Requires restart to take effect."""
    config_updates = {}

    if center_freq is not None:
        config_updates['center_freq'] = parse_frequency(center_freq)
    if sample_rate is not None:
        config_updates['sample_rate'] = parse_frequency(sample_rate)
    if fft_size is not None:
        config_updates['fft_size'] = fft_size
    if gain is not None:
        config_updates['gain'] = gain
    if averaging is not None:
        config_updates['averaging'] = averaging

    spectrum_manager.configure(**config_updates)

    return {
        "message": "Configuration updated" + (" (restart required)" if spectrum_manager.is_running else ""),
        "config": spectrum_manager.get_status()
    }


@router.websocket("/live/ws")
async def spectrum_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time spectrum data."""
    await websocket.accept()
    logger.info("Spectrum WebSocket client connected")

    # Queue for this client
    queue: asyncio.Queue = asyncio.Queue(maxsize=10)

    async def send_to_client(data: dict):
        """Callback to queue data for this client."""
        try:
            # Non-blocking put, drop old data if queue is full
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(data)
        except Exception as e:
            logger.error(f"Error queuing spectrum data: {e}")

    # Register as client
    spectrum_manager.add_client(send_to_client)

    try:
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "data": spectrum_manager.get_status()
        })

        while True:
            try:
                # Wait for data with timeout
                data = await asyncio.wait_for(queue.get(), timeout=1.0)
                await websocket.send_json(data)
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        logger.info("Spectrum WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Spectrum WebSocket error: {e}")
    finally:
        spectrum_manager.remove_client(send_to_client)
        logger.info("Spectrum WebSocket client removed")
