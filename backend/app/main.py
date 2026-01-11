"""FastAPI application entry point for RTL-SDR Dashboard."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db, get_session, DatabaseManager, async_session
from .rtl_manager import rtl_manager
from .mqtt_client import mqtt_client
from .websocket import ws_manager, handle_websocket
from .routers import sensors_router, devices_router, signals_router, system_router, audio_router, spectrum_router
from .audio_manager import audio_manager
from .spectrum_manager import spectrum_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


async def handle_reading(reading: dict):
    """Process incoming sensor readings."""
    # Save to database
    async with async_session() as session:
        db = DatabaseManager(session)
        await db.save_reading(reading)
        await session.commit()

    # Broadcast to WebSocket clients
    await ws_manager.broadcast_reading(reading)

    # Publish to MQTT
    if mqtt_client.connected:
        await mqtt_client.publish_reading(reading)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown."""
    logger.info("Starting RTL-SDR Dashboard...")

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Connect to MQTT
    if await mqtt_client.connect():
        logger.info("Connected to MQTT broker")
    else:
        logger.warning("Failed to connect to MQTT broker")

    # Register reading callback
    rtl_manager.add_callback(handle_reading)

    # Auto-start rtl_433 if binary exists
    if settings.rtl433_bin.exists():
        if await rtl_manager.start():
            logger.info("rtl_433 auto-started")
        else:
            logger.warning("Failed to auto-start rtl_433")
    else:
        logger.warning(f"rtl_433 binary not found at {settings.rtl433_bin}")

    logger.info("RTL-SDR Dashboard started successfully")

    yield

    # Shutdown
    logger.info("Shutting down RTL-SDR Dashboard...")

    # Stop audio streaming
    if audio_manager.is_running:
        await audio_manager.stop()

    # Stop spectrum analyzer
    if spectrum_manager.is_running:
        await spectrum_manager.stop()

    # Stop rtl_433
    if rtl_manager.is_running:
        await rtl_manager.stop()

    # Disconnect MQTT
    if mqtt_client.connected:
        await mqtt_client.disconnect()

    logger.info("RTL-SDR Dashboard shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="RTL-SDR Dashboard API",
    description="Real-time sensor monitoring and signal analysis with RTL-SDR",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dashboard
        "http://localhost:3001",  # Vue signal analyzer
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sensors_router, prefix=settings.api_prefix)
app.include_router(devices_router, prefix=settings.api_prefix)
app.include_router(signals_router, prefix=settings.api_prefix)
app.include_router(system_router, prefix=settings.api_prefix)
app.include_router(audio_router, prefix=settings.api_prefix)
app.include_router(spectrum_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "RTL-SDR Dashboard API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/v1/system/health",
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await handle_websocket(websocket)


def run():
    """Run the application with uvicorn."""
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
