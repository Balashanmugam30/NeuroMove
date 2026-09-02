"""NeuroMove Transport Protocol Models and Message Envelopes.

Defines typed messages for WebSocket handshakes, heartbeats, subscriptions,
snapshots, and event transport.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from neuromove.domain.enums import OperatingMode
from neuromove.domain.models import (
    ObstacleData,
    RobotState,
    SafetyState,
    Session,
    SignalQualityMetrics,
    Trial,
)
from neuromove.events.envelope import EventEnvelope


def generate_connection_id() -> str:
    """Generate a unique connection identifier."""
    return f"conn_{uuid.uuid4().hex[:12]}"


class TransportMessageType(StrEnum):
    HELLO = "HELLO"
    WELCOME = "WELCOME"
    PING = "PING"
    PONG = "PONG"
    SUBSCRIBE = "SUBSCRIBE"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    EVENT = "EVENT"
    SNAPSHOT = "SNAPSHOT"
    RESET = "RESET"
    ERROR = "ERROR"


class TransportStream(StrEnum):
    LIVE = "live"
    EEG = "eeg"
    ROBOT = "robot"
    SAFETY = "safety"
    CONFIDENCE = "confidence"
    INTENT = "intent"
    RESILIENCE = "resilience"
    TRANSPORT = "transport"
    HARDWARE = "hardware"
    EEG_ACQUISITION = "eeg_acquisition"
    RESEARCH = "research"
    ALL = "all"


class ClientState(StrEnum):
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    SUBSCRIBING = "SUBSCRIBING"
    STREAMING = "STREAMING"
    DEGRADED = "DEGRADED"
    DISCONNECTED = "DISCONNECTED"
    RECONNECTING = "RECONNECTING"


class HelloPayload(BaseModel):
    client_id: str = Field(default="client_web_001")
    client_name: str = Field(default="NeuroMove Web Command Center")
    client_version: str = Field(default="0.1.0")
    requested_streams: list[str] = Field(default_factory=lambda: ["live", "robot", "safety"])


class WelcomePayload(BaseModel):
    protocol_version: str = Field(default="1.0")
    schema_version: str = Field(default="1.0.0")
    server_version: str = Field(default="0.1.0")
    mode: OperatingMode = Field(default=OperatingMode.SIMULATION)
    connection_id: str
    available_streams: list[str] = Field(
        default_factory=lambda: ["live", "eeg", "robot", "safety", "all"]
    )
    heartbeat_interval_ms: int = Field(default=5000)
    heartbeat_timeout_ms: int = Field(default=3000)


class PingPayload(BaseModel):
    client_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    seq: int = Field(default=0)


class PongPayload(BaseModel):
    client_time: datetime
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    seq: int = Field(default=0)


class SubscribePayload(BaseModel):
    streams: list[str] = Field(default_factory=lambda: ["live"])
    filter_session_id: str | None = None
    filter_mode: OperatingMode | None = None


class SnapshotPayload(BaseModel):
    mode: OperatingMode = Field(default=OperatingMode.SIMULATION)
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
    latest_event_sequence: int = Field(default=0, ge=0)
    active_session: Session | None = None
    active_trial: Trial | None = None
    robot_state: RobotState | None = None
    safety_state: SafetyState | None = None
    signal_quality: SignalQualityMetrics | None = None
    obstacle_data: ObstacleData | None = None
    simulation_status: dict[str, Any] | None = None


class TransportErrorPayload(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: dict[str, Any] | None = None


class TransportDiagnostics(BaseModel):
    active_connections: int = 0
    total_connections: int = 0
    connection_failures: int = 0
    reconnect_count: int = 0
    events_sent: int = 0
    events_dropped: int = 0
    queue_overflows: int = 0
    heartbeat_timeouts: int = 0
    invalid_messages: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    average_latency_ms: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TransportMessage(BaseModel):
    """Universal typed WebSocket wire message envelope."""

    type: TransportMessageType
    stream: str | None = None
    transport_seq: int | None = Field(default=None, ge=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    event: EventEnvelope[Any] | None = None
    payload: dict[str, Any] | None = None
