"""Domain models, enumerations, and schemas for Phase 19 Command Transport & ESP32 Protocol."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from neuromove.domain.enums import SafetyDecision


class ProtocolVersion(StrEnum):
    V1_0 = "1.0"


class DeviceType(StrEnum):
    ESP32_SIMULATOR = "ESP32_SIMULATOR"
    ESP32_HARDWARE = "ESP32_HARDWARE"
    VIRTUAL_ENDPOINT = "VIRTUAL_ENDPOINT"


class DeviceCapability(StrEnum):
    COMMAND_RECEIVE = "COMMAND_RECEIVE"
    COMMAND_ACK = "COMMAND_ACK"
    COMMAND_NACK = "COMMAND_NACK"
    HEARTBEAT = "HEARTBEAT"
    STATUS_REPORT = "STATUS_REPORT"
    SAFE_STOP = "SAFE_STOP"
    SIMULATION = "SIMULATION"


class CommandType(StrEnum):
    EXECUTE_INTENT = "EXECUTE_INTENT"
    CANCEL_INTENT = "CANCEL_INTENT"
    STOP = "STOP"
    HEARTBEAT = "HEARTBEAT"
    STATUS_REQUEST = "STATUS_REQUEST"
    CAPABILITY_REQUEST = "CAPABILITY_REQUEST"
    PROTOCOL_NEGOTIATE = "PROTOCOL_NEGOTIATE"


class TransportCommandStatus(StrEnum):
    CREATED = "CREATED"
    VALIDATED = "VALIDATED"
    QUEUED = "QUEUED"
    SENT = "SENT"
    ACKED = "ACKED"
    REJECTED = "REJECTED"
    RETRYING = "RETRYING"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
    CANCELLED = "CANCELLED"
    DUPLICATE = "DUPLICATE"


class MessageType(StrEnum):
    COMMAND = "COMMAND"
    ACK = "ACK"
    NACK = "NACK"
    HEARTBEAT_REQUEST = "HEARTBEAT_REQUEST"
    HEARTBEAT_RESPONSE = "HEARTBEAT_RESPONSE"
    NEGOTIATE_REQUEST = "NEGOTIATE_REQUEST"
    NEGOTIATE_RESPONSE = "NEGOTIATE_RESPONSE"


class CommandAckStatus(StrEnum):
    COMMAND_RECEIVED = "COMMAND_RECEIVED"
    COMMAND_ACCEPTED = "COMMAND_ACCEPTED"
    COMMAND_REJECTED = "COMMAND_REJECTED"
    COMMAND_DUPLICATE = "COMMAND_DUPLICATE"
    COMMAND_EXPIRED = "COMMAND_EXPIRED"
    COMMAND_INVALID = "COMMAND_INVALID"


class TransportConnectionState(StrEnum):
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    NEGOTIATING = "NEGOTIATING"
    CONNECTED = "CONNECTED"
    DEGRADED = "DEGRADED"
    STALE = "STALE"
    DISCONNECTING = "DISCONNECTING"


class CommandTraceDirection(StrEnum):
    TX = "TX"
    RX = "RX"


class CommandTraceDecodeStatus(StrEnum):
    VALID = "VALID"
    CORRUPTED = "CORRUPTED"
    DROPPED = "DROPPED"
    TRUNCATED = "TRUNCATED"


class DeviceIdentity(BaseModel):
    device_id: str
    device_type: DeviceType = DeviceType.ESP32_SIMULATOR
    firmware_version: str = "esp32-neuromove-v0.1.0"
    protocol_version: str = "1.0"
    capabilities: list[DeviceCapability] = Field(
        default_factory=lambda: [
            DeviceCapability.COMMAND_RECEIVE,
            DeviceCapability.COMMAND_ACK,
            DeviceCapability.COMMAND_NACK,
            DeviceCapability.HEARTBEAT,
            DeviceCapability.STATUS_REPORT,
            DeviceCapability.SAFE_STOP,
            DeviceCapability.SIMULATION,
        ]
    )
    boot_id: str
    session_id: str | None = None


class ExecutionAuthorization(BaseModel):
    """Input contract from Phase 17 Safety Arbitration Gate."""

    authorization_id: str
    intent_id: str
    intent_class: str
    decision: SafetyDecision
    policy_version: str
    evaluation_id: str
    model_version_id: str
    subject_id: str
    session_id: str
    issued_at: str
    expires_at: str
    reason: str


class CommandPayload(BaseModel):
    intent_class: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommandEnvelope(BaseModel):
    """Canonical Command Envelope for transport."""

    protocol_version: str = "1.0"
    message_type: MessageType = MessageType.COMMAND
    message_id: str
    command_id: str
    sequence_number: int
    device_id: str
    intent_id: str | None = None
    authorization_id: str | None = None
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str | None = None
    issued_at: str
    expires_at: str
    payload: CommandPayload
    flags: dict[str, bool] = Field(default_factory=dict)
    checksum: str = ""


class CommandAck(BaseModel):
    ack_id: str
    message_id: str
    command_id: str
    sequence_number: int
    status: CommandAckStatus
    timestamp: str
    reason: str | None = None
    round_trip_ms: float | None = None


class CommandNack(BaseModel):
    nack_id: str
    message_id: str
    command_id: str | None = None
    sequence_number: int | None = None
    error_code: str
    reason: str
    retryable: bool
    timestamp: str


class CommandReject(BaseModel):
    command_id: str | None = None
    reason_code: str
    message: str
    retryable: bool
    timestamp: str


class TransportFrame(BaseModel):
    frame_id: str
    length: int
    checksum: str
    envelope: CommandEnvelope
    raw_hex_preview: str | None = None
    timestamp: str


class HeartbeatStatus(BaseModel):
    last_sent: str | None = None
    last_received: str | None = None
    round_trip_time_ms: float | None = None
    missed_count: int = 0
    link_state: TransportConnectionState = TransportConnectionState.DISCONNECTED


class RetryPolicy(BaseModel):
    max_attempts: int = 3
    initial_delay_ms: float = 100.0
    backoff_multiplier: float = 2.0
    max_delay_ms: float = 2000.0
    jitter_enabled: bool = False


class CommandTrace(BaseModel):
    trace_id: str
    timestamp: str
    direction: CommandTraceDirection
    device_id: str
    message_id: str
    command_id: str | None = None
    sequence_number: int
    message_type: str
    length_bytes: int
    checksum: str
    decode_status: CommandTraceDecodeStatus
    ack_status: str | None = None
    latency_ms: float | None = None
    error_code: str | None = None


class TransportMetrics(BaseModel):
    commands_sent: int = 0
    commands_acknowledged: int = 0
    commands_rejected: int = 0
    commands_duplicated: int = 0
    commands_expired: int = 0
    retries_total: int = 0
    timeouts_total: int = 0
    checksum_failures: int = 0
    sequence_gaps: int = 0
    sequence_duplicates: int = 0
    heartbeat_failures: int = 0
    reconnections: int = 0
    average_rtt_ms: float = 0.0
    p95_rtt_ms: float = 0.0


class TransportLabStatus(BaseModel):
    connection_state: TransportConnectionState
    device: DeviceIdentity | None = None
    negotiated_capabilities: list[DeviceCapability] = Field(default_factory=list)
    heartbeat: HeartbeatStatus
    metrics: TransportMetrics
    active_commands_count: int = 0
    simulated_mode: bool = True
    updated_at: str


class TransportScenarioResult(BaseModel):
    scenario_id: str
    name: str
    description: str
    passed: bool
    expected_state: str
    observed_state: str
    expected_ack_status: str
    observed_ack_status: str
    retries_observed: int = 0
    details: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
