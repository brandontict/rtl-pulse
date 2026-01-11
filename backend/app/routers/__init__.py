"""API routers package."""

from .sensors import router as sensors_router
from .devices import router as devices_router
from .signals import router as signals_router
from .system import router as system_router
from .audio import router as audio_router
from .spectrum import router as spectrum_router

__all__ = ["sensors_router", "devices_router", "signals_router", "system_router", "audio_router", "spectrum_router"]
