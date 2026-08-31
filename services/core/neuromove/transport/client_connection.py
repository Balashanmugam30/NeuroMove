"""NeuroMove Client Connection Session & Bounded Queue Handler.

Encapsulates individual client WebSocket sessions with bounded async queuing,
backpressure policies, monotonic transport sequences, and heartbeat tracking.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from fastapi import WebSocket

from neuromove.domain.enums import OperatingMode
from neuromove.transport.models import (
    ClientState,
    TransportMessage,
    generate_connection_id,
)

logger = logging.getLogger("neuromove.transport.client")


class ClientConnection:
    """Manages an active WebSocket client session with bounded asynchronous queue

    and backpressure policy enforcement.
    """

    def __init__(
        self,
        websocket: WebSocket,
        connection_id: str | None = None,
        max_queue_size: int = 200,
    ) -> None:
        self.connection_id: str = connection_id or generate_connection_id()
        self.websocket: WebSocket = websocket
        self.max_queue_size: int = max_queue_size

        self.client_id: str = "client_unknown"
        self.client_name: str = "NeuroMove Web Client"
        self.client_version: str = "0.1.0"
        self.state: ClientState = ClientState.CONNECTING

        self.subscribed_streams: set[str] = {"live"}
        self.filter_session_id: str | None = None
        self.filter_mode: OperatingMode | None = None

        self.connected_at: datetime = datetime.now(UTC)
        self.last_ping: datetime | None = None
        self.last_pong: datetime | None = None
        self.missed_heartbeats: int = 0

        self.events_sent: int = 0
        self.events_dropped: int = 0
        self.bytes_sent: int = 0
        self.bytes_received: int = 0

        self._transport_seq: int = 0
        self._queue: asyncio.Queue[TransportMessage] = asyncio.Queue(maxsize=self.max_queue_size)
        self._sender_task: asyncio.Task[None] | None = None
        self._is_closed: bool = False

    def next_transport_sequence(self) -> int:
        self._transport_seq += 1
        return self._transport_seq

    def start(self) -> None:
        """Start the background asynchronous queue draining task."""
        self._is_closed = False
        self._sender_task = asyncio.create_task(
            self._sender_loop(), name=f"ws-send-{self.connection_id}"
        )

    async def close(self) -> None:
        """Gracefully close sender task and mark connection disconnected."""
        if self._is_closed:
            return
        self._is_closed = True
        self.state = ClientState.DISCONNECTED
        if self._sender_task and not self._sender_task.done():
            self._sender_task.cancel()
            try:
                await self._sender_task
            except asyncio.CancelledError:
                pass

    def enqueue_message(self, message: TransportMessage) -> bool:
        """Enqueue message with backpressure policy.

        Returns True if queued, False if dropped due to queue congestion.
        """
        if self._is_closed or self.state == ClientState.DISCONNECTED:
            return False

        # Assign transport sequence number
        if message.transport_seq is None:
            message.transport_seq = self.next_transport_sequence()

        # Stream & Mode filtering
        if (
            message.stream
            and message.stream not in self.subscribed_streams
            and "all" not in self.subscribed_streams
        ):
            return False

        if message.event:
            if self.filter_mode and message.event.mode != self.filter_mode:
                return False
            if self.filter_session_id and message.event.session_id != self.filter_session_id:
                return False

        # Queue capacity check
        if self._queue.full():
            # Apply Backpressure Policy by Stream Type
            if message.stream == "eeg":
                # High-frequency stream: drop newest or discard oldest batch
                self.events_dropped += 1
                return False

            if message.stream in ("robot", "safety"):
                # State stream: coalesce by trying to drop oldest state packet
                try:
                    _ = self._queue.get_nowait()
                    self.events_dropped += 1
                except (asyncio.QueueEmpty, ValueError):
                    pass

            # For critical events (HELLO/WELCOME/SNAPSHOT/SAFETY_ALERT), mark degraded
            self.state = ClientState.DEGRADED
            try:
                self._queue.put_nowait(message)
                return True
            except asyncio.QueueFull:
                self.events_dropped += 1
                return False

        try:
            self._queue.put_nowait(message)
            return True
        except asyncio.QueueFull:
            self.events_dropped += 1
            return False

    async def _sender_loop(self) -> None:
        """Continuously drain queue and serialize payloads to the WebSocket wire."""
        try:
            while not self._is_closed:
                msg = await self._queue.get()
                payload_dict = msg.model_dump(mode="json")
                try:
                    await self.websocket.send_json(payload_dict)
                    self.events_sent += 1
                    # Approximate byte tracking
                    self.bytes_sent += len(str(payload_dict))
                except Exception as exc:
                    logger.warning("Failed to send WS message to %s: %s", self.connection_id, exc)
                    self.state = ClientState.DISCONNECTED
                    break
                finally:
                    self._queue.task_done()
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Unexpected error in sender loop for %s: %s", self.connection_id, exc)
            self.state = ClientState.DISCONNECTED

    def record_pong(self, client_time: datetime) -> None:
        """Record received heartbeat response and reset missed counter."""
        self.last_pong = datetime.now(UTC)
        self.missed_heartbeats = 0
        if self.state == ClientState.DEGRADED and not self._queue.full():
            self.state = ClientState.STREAMING

    def record_ping(self) -> None:
        """Record sent ping heartbeat."""
        self.last_ping = datetime.now(UTC)
        self.missed_heartbeats += 1
        if self.missed_heartbeats >= 3:
            self.state = ClientState.DEGRADED
