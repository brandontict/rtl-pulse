"""Audio streaming API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from ..audio_manager import audio_manager, AudioConfig, Modulation, FREQUENCY_PRESETS
from ..rtl_manager import rtl_manager


router = APIRouter(prefix="/audio", tags=["audio"])


class AudioStartRequest(BaseModel):
    frequency: str = "101.5M"
    modulation: str = "wbfm"
    gain: int = 40
    squelch: int = 0
    ppm: int = 0


class AudioStatusResponse(BaseModel):
    running: bool
    frequency: Optional[str]
    modulation: Optional[str]
    sample_rate: Optional[int]
    output_rate: Optional[int]
    gain: Optional[int]


@router.get("/status")
async def get_audio_status() -> AudioStatusResponse:
    """Get current audio streaming status."""
    status = audio_manager.get_status()
    return AudioStatusResponse(**status)


@router.post("/start")
async def start_audio(request: AudioStartRequest):
    """Start audio streaming with the given configuration."""
    # Check if rtl_433 is running - can't use SDR for both
    if rtl_manager.is_running:
        raise HTTPException(
            status_code=409,
            detail="Cannot start audio while rtl_433 is running. Stop rtl_433 first."
        )

    # Check if audio is already running
    if audio_manager.is_running:
        raise HTTPException(
            status_code=409,
            detail="Audio streaming is already running. Stop it first."
        )

    # Map modulation string to enum
    try:
        mod = Modulation(request.modulation)
    except ValueError:
        mod = Modulation.FM

    # Determine sample rate based on modulation
    if mod == Modulation.WFM:
        sample_rate = 200000
    elif mod in (Modulation.AM, Modulation.USB, Modulation.LSB):
        sample_rate = 48000
    else:
        sample_rate = 48000

    config = AudioConfig(
        frequency=request.frequency,
        modulation=mod,
        sample_rate=sample_rate,
        output_rate=48000,
        gain=request.gain,
        squelch=request.squelch,
        ppm=request.ppm,
    )

    try:
        await audio_manager.start(config)
        return {
            "status": "started",
            "message": f"Audio streaming started on {request.frequency}",
            "config": audio_manager.get_status()
        }
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_audio():
    """Stop audio streaming."""
    await audio_manager.stop()
    return {
        "status": "stopped",
        "message": "Audio streaming stopped"
    }


@router.get("/stream")
async def stream_audio():
    """Stream raw audio data (16-bit signed PCM, 48kHz, mono)."""
    if not audio_manager.is_running:
        raise HTTPException(
            status_code=400,
            detail="Audio streaming is not running. Start it first."
        )

    return StreamingResponse(
        audio_manager.stream_audio(),
        media_type="audio/raw",
        headers={
            "Content-Type": "audio/raw",
            "X-Sample-Rate": "48000",
            "X-Channels": "1",
            "X-Bit-Depth": "16",
            "X-Format": "signed-integer",
            "X-Byte-Order": "little-endian",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/presets")
async def get_frequency_presets():
    """Get common frequency presets."""
    return {
        "presets": FREQUENCY_PRESETS,
        "count": len(FREQUENCY_PRESETS)
    }


@router.get("/modulations")
async def get_modulations():
    """Get available modulation modes."""
    return {
        "modulations": [
            {"id": "wbfm", "name": "Wideband FM", "description": "FM broadcast radio (87.5-108 MHz)"},
            {"id": "fm", "name": "Narrow FM", "description": "Two-way radio, amateur, FRS/GMRS"},
            {"id": "am", "name": "AM", "description": "Aircraft, CB radio, shortwave"},
            {"id": "usb", "name": "Upper Sideband", "description": "Amateur radio SSB"},
            {"id": "lsb", "name": "Lower Sideband", "description": "Amateur radio SSB"},
            {"id": "raw", "name": "Raw I/Q", "description": "Unprocessed samples"},
        ]
    }


@router.post("/tune")
async def tune_frequency(
    frequency: str = Query(..., description="Frequency to tune to (e.g., '101.5M')"),
    modulation: Optional[str] = Query(None, description="Modulation mode")
):
    """Quick tune to a new frequency without full restart."""
    if not audio_manager.is_running:
        raise HTTPException(
            status_code=400,
            detail="Audio streaming is not running. Use /start instead."
        )

    # Get current config
    current = audio_manager.config
    if not current:
        raise HTTPException(status_code=500, detail="No active configuration")

    # Create new config with updated frequency
    new_config = AudioConfig(
        frequency=frequency,
        modulation=Modulation(modulation) if modulation else current.modulation,
        sample_rate=current.sample_rate,
        output_rate=current.output_rate,
        gain=current.gain,
        squelch=current.squelch,
        ppm=current.ppm,
    )

    try:
        await audio_manager.start(new_config)
        return {
            "status": "tuned",
            "message": f"Tuned to {frequency}",
            "config": audio_manager.get_status()
        }
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
