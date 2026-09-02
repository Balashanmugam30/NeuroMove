"""Domain models and typed schemas for Phase 20 Hardware-in-the-Loop integration."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from neuromove.transport_protocol.models import (
    DeviceCapability,
    HeartbeatStatus,
    TransportMetrics,
)


class HardwareEndpointMode(StrEnum):
    """Explicit operating mode for the downstream embedded endpoint."""

    SIMULATOR = "SIMULATOR"
    VIRTUAL_SERIAL = "VIRTUAL_SERIAL"
    HIL_ESP32 = "HIL_ESP32"


class HardwareConnectionState(StrEnum):
    """Lifecycle connection states for the hardware link."""

    DISCONNECTED = "DISCONNECTED"
    DISCOVERING = "DISCOVERING"
    CONNECTING = "CONNECTING"
    NEGOTIATING = "NEGOTIATING"
    CONNECTED = "CONNECTED"
    READY = "READY"
    DEGRADED = "DEGRADED"
    STALE = "STALE"
    RECONNECTING = "RECONNECTING"
    ERROR = "ERROR"


class SerialPortDescriptor(BaseModel):
    """Metadata describing an enumerated serial communication port."""

    port: str
    description: str = ""
    manufacturer: str | None = None
    serial_number: str | None = None
    vid: str | None = None
    pid: str | None = None
    device_hint: str | None = None
    is_open: bool = False
    baud_rate: int = 115200


class FirmwareIdentity(BaseModel):
    """Authoritative firmware identification descriptor."""

    firmware_name: str = "esp32-neuromove-hil"
    firmware_version: str = "0.1.0"
    build_hash: str = "bld_20260901_hil"
    compiled_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    target_mcu: str = "ESP32-S3"
    is_hil_only: bool = True


class Esp32DeviceInfo(BaseModel):
    """Comprehensive device identity descriptor negotiated over wire."""

    device_id: str
    device_type: str = "ESP32_HIL_ENDPOINT"
    device_mode: HardwareEndpointMode = HardwareEndpointMode.SIMULATOR
    firmware_version: str = "esp32-neuromove-v0.1.0"
    firmware_build: str = "rel-2026.09.01"
    protocol_version: str = "1.0"
    boot_id: str = Field(default_factory=lambda: f"boot_{uuid.uuid4().hex[:8]}")
    hardware_revision: str = "ESP32-DevKitC-v4"
    capabilities: list[DeviceCapability] = Field(default_factory=list)
    uptime_ms: int = 0
    hashed_serial_identifier: str | None = None
    last_seen: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class HardwareHealth(BaseModel):
    """Granular multi-factor health telemetry for the hardware boundary."""

    link_state: HardwareConnectionState = HardwareConnectionState.DISCONNECTED
    application_healthy: bool = True
    device_connected: bool = False
    device_ready: bool = False
    heartbeat_healthy: bool = False
    command_channel_healthy: bool = False
    round_trip_time_ms: float | None = None
    missed_heartbeats: int = 0


class HardwareStatus(BaseModel):
    """Top-level aggregate status of the Hardware-in-the-Loop laboratory."""

    connection_state: HardwareConnectionState = HardwareConnectionState.DISCONNECTED
    active_mode: HardwareEndpointMode = HardwareEndpointMode.SIMULATOR
    device: Esp32DeviceInfo | None = None
    firmware: FirmwareIdentity | None = None
    session_id: str | None = None
    boot_id: str | None = None
    heartbeat: HeartbeatStatus | None = None
    health: HardwareHealth | None = None
    metrics: TransportMetrics | None = None
    simulated_mode: bool = True
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class HardwareHandshake(BaseModel):
    """Protocol negotiation request payload."""

    client_protocol_version: str = "1.0"
    host_id: str = "neuromove_host_01"
    session_id: str = Field(default_factory=lambda: f"sess_hw_{uuid.uuid4().hex[:8]}")
    requested_capabilities: list[str] = Field(
        default_factory=lambda: [
            "COMMAND_RECEIVE",
            "COMMAND_ACK",
            "COMMAND_NACK",
            "HEARTBEAT",
            "STATUS_REPORT",
            "SAFE_STOP",
            "HIL_ONLY",
            "NO_ACTUATION",
        ]
    )
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class HardwareSession(BaseModel):
    """Authoritative hardware connection session."""

    session_id: str
    device_id: str
    boot_id: str
    device_mode: HardwareEndpointMode
    protocol_version: str = "1.0"
    firmware_version: str = "0.1.0"
    connected_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    disconnected_at: str | None = None
    status: str = "ACTIVE"
    sequence_base: int = 0


class HardwareDiagnostic(BaseModel):
    """Diagnostic event log entry."""

    diag_id: str = Field(default_factory=lambda: f"diag_{uuid.uuid4().hex[:8]}")
    device_id: str
    session_id: str | None = None
    category: str
    severity: str = "INFO"
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    details: dict[str, Any] = Field(default_factory=dict)


class HardwareFault(BaseModel):
    """Controlled fault injection descriptor."""

    fault_type: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    active: bool = False


class HardwareRecoveryResult(BaseModel):
    """Result of an automated or manual link recovery cycle."""

    recovery_id: str = Field(default_factory=lambda: f"rec_{uuid.uuid4().hex[:8]}")
    fault_type: str
    recovered: bool
    old_session_id: str | None = None
    new_session_id: str | None = None
    renegotiated: bool = False
    reconciled: bool = False
    stale_commands_invalidated: int = 0
    rtt_ms: float | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class HILExperiment(BaseModel):
    """Formal deterministic HIL experiment manifest and outcome."""

    experiment_id: str = Field(default_factory=lambda: f"exp_hil_{uuid.uuid4().hex[:8]}")
    scenario_id: str
    name: str
    device_mode: HardwareEndpointMode
    device_id: str
    firmware_version: str
    protocol_version: str
    seed: int | None = 42
    manifest_hash: str
    passed: bool
    verdict: str
    started_at: str
    completed_at: str
    details: dict[str, Any] = Field(default_factory=dict)


class HILScenarioResult(BaseModel):
    """Outcome of a single canonical HIL test scenario."""

    scenario_id: str
    name: str
    description: str
    passed: bool
    observed_ack_status: str | None = None
    transmission_count: int = 0
    ack_count: int = 0
    nack_count: int = 0
    latency_ms: float | None = None
    failure_reason: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
