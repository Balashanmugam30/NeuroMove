"""WebSocket Connection Manager and Stream Broadcaster (Phase 04).

Delegates to the modular transport core (StreamRouter, ConnectionRegistry, LatestValueCache)
for robust backpressure, bounded queues, and typed message transport.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

from neuromove.events.envelope import EventEnvelope
from neuromove.simulation.eeg_generator import EEGChunk
from neuromove.transport.stream_router import stream_router
from neuromove.transport.ws_handler import handle_websocket_session

logger = logging.getLogger("neuromove.ws")


class ConnectionManager:
    """Compatibility adapter delegating to Phase 04 Transport Layer."""

    async def connect_live(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="live")

    async def connect_eeg(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="eeg")

    async def connect_robot(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="robot")

    async def connect_safety(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="safety")

    async def connect_resilience(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="resilience")

    async def connect_all(self, websocket: WebSocket) -> None:
        await handle_websocket_session(websocket, default_stream="all")

    def broadcast_event(self, envelope: EventEnvelope[Any]) -> None:
        stream_router.handle_canonical_event(envelope)

    def broadcast_eeg_chunk(self, chunk: EEGChunk) -> None:
        stream_router.handle_eeg_chunk(chunk)


ws_manager = ConnectionManager()
