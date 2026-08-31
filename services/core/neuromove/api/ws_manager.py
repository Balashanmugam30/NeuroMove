"""WebSocket Connection Manager and Stream Broadcaster.

Broadcasting real-time canonical events, synthetic EEG chunks, and robot telemetry.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

from neuromove.events.dispatcher import default_dispatcher
from neuromove.events.envelope import EventEnvelope
from neuromove.simulation.eeg_generator import EEGChunk
from neuromove.simulation.runner import simulation_engine

logger = logging.getLogger("neuromove.ws")


class ConnectionManager:
    """Manages active WebSockets and distributes typed streams."""

    def __init__(self) -> None:
        self.live_connections: list[WebSocket] = []
        self.eeg_connections: list[WebSocket] = []
        self.robot_connections: list[WebSocket] = []
        self.safety_connections: list[WebSocket] = []

        # Hook into default event dispatcher
        default_dispatcher.subscribe("*", self._handle_canonical_event)
        # Hook into simulation chunk emission
        simulation_engine.register_chunk_listener(self._handle_eeg_chunk)

    async def connect_live(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.live_connections.append(websocket)

    def disconnect_live(self, websocket: WebSocket) -> None:
        if websocket in self.live_connections:
            self.live_connections.remove(websocket)

    async def connect_eeg(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.eeg_connections.append(websocket)

    def disconnect_eeg(self, websocket: WebSocket) -> None:
        if websocket in self.eeg_connections:
            self.eeg_connections.remove(websocket)

    async def connect_robot(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.robot_connections.append(websocket)

    def disconnect_robot(self, websocket: WebSocket) -> None:
        if websocket in self.robot_connections:
            self.robot_connections.remove(websocket)

    async def connect_safety(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.safety_connections.append(websocket)

    def disconnect_safety(self, websocket: WebSocket) -> None:
        if websocket in self.safety_connections:
            self.safety_connections.remove(websocket)

    def _handle_canonical_event(self, envelope: EventEnvelope) -> None:
        """Forward canonical event envelope to live and safety WebSocket subscribers."""
        payload_dict = envelope.model_dump(mode="json")
        for ws in list(self.live_connections):
            try:
                asyncio.create_task(ws.send_json(payload_dict))
            except Exception:
                pass

        if "SAFETY" in envelope.event_type.value or envelope.event_type.value == "EMERGENCY_STOP":
            for ws in list(self.safety_connections):
                try:
                    asyncio.create_task(ws.send_json(payload_dict))
                except Exception:
                    pass

        if "ROBOT" in envelope.event_type.value:
            for ws in list(self.robot_connections):
                try:
                    asyncio.create_task(ws.send_json(payload_dict))
                except Exception:
                    pass

    def _handle_eeg_chunk(self, chunk: EEGChunk) -> None:
        """Forward high-frequency EEGChunk samples to eeg WebSocket subscribers."""
        chunk_dict = chunk.model_dump(mode="json")
        for ws in list(self.eeg_connections):
            try:
                asyncio.create_task(ws.send_json(chunk_dict))
            except Exception:
                pass


ws_manager = ConnectionManager()
