"""WebSocket manager for real-time data streaming to frontend."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            await self.disconnect(websocket)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected WebSockets."""
        if not self.active_connections:
            return

        # Serialize message once
        message_json = json.dumps(message, default=self._json_serializer)

        # Send to all connections
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Failed to broadcast to connection: {e}")
                disconnected.append(connection)

        # Remove failed connections
        for connection in disconnected:
            await self.disconnect(connection)

    async def broadcast_reading(self, reading: dict):
        """Broadcast a sensor reading to all clients."""
        await self.broadcast({
            "type": "reading",
            "data": reading,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_device_update(self, device: dict):
        """Broadcast a device update to all clients."""
        await self.broadcast({
            "type": "device",
            "data": device,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_status(self, status: dict):
        """Broadcast system status to all clients."""
        await self.broadcast({
            "type": "status",
            "data": status,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_error(self, error: str):
        """Broadcast an error message to all clients."""
        await self.broadcast({
            "type": "error",
            "data": {"message": error},
            "timestamp": datetime.utcnow().isoformat(),
        })

    @staticmethod
    def _json_serializer(obj: Any) -> str:
        """Custom JSON serializer for datetime objects."""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    @property
    def connection_count(self) -> int:
        """Return the number of active connections."""
        return len(self.active_connections)


# Global connection manager
ws_manager = ConnectionManager()


async def handle_websocket(websocket: WebSocket):
    """Handle a WebSocket connection lifecycle."""
    await ws_manager.connect(websocket)

    try:
        while True:
            # Handle incoming messages (for future bi-directional communication)
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=30.0  # Heartbeat timeout
                )

                # Process client messages
                if data.get("type") == "ping":
                    await ws_manager.send_personal_message(
                        {"type": "pong", "timestamp": datetime.utcnow().isoformat()},
                        websocket
                    )
                elif data.get("type") == "subscribe":
                    # Handle subscription requests
                    logger.info(f"Client subscribed to: {data.get('topics', [])}")

            except asyncio.TimeoutError:
                # Send heartbeat on timeout
                try:
                    await ws_manager.send_personal_message(
                        {"type": "heartbeat", "timestamp": datetime.utcnow().isoformat()},
                        websocket
                    )
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket)
