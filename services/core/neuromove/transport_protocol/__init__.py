"""NeuroMove Transport Protocol & Framing Subsystem (Phase 19).

Exports domain models, framing encoders, adapters, sequence managers,
and authoritative TransportProtocolService.
"""

from __future__ import annotations

from neuromove.transport_protocol.adapters import SimulatedEsp32Adapter, TransportAdapter
from neuromove.transport_protocol.checksum import compute_crc32, verify_crc32
from neuromove.transport_protocol.codec import decode_command, encode_command
from neuromove.transport_protocol.commands import (
    create_cancel_command,
    create_command_envelope,
    create_stop_command,
    validate_authorization,
)
from neuromove.transport_protocol.framing import pack_frame, unpack_frame
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandEnvelope,
    CommandNack,
    CommandPayload,
    CommandTrace,
    CommandType,
    DeviceCapability,
    DeviceIdentity,
    DeviceType,
    ExecutionAuthorization,
    HeartbeatStatus,
    RetryPolicy,
    TransportCommandStatus,
    TransportConnectionState,
    TransportFrame,
    TransportLabStatus,
    TransportMetrics,
    TransportScenarioResult,
)
from neuromove.transport_protocol.protocol import (
    FRAME_END_DELIMITER,
    FRAME_START_DELIMITER,
    MAX_FRAME_PAYLOAD_BYTES,
    PROTOCOL_VERSION,
    SUPPORTED_PROTOCOL_VERSIONS,
)
from neuromove.transport_protocol.scenarios import ScenarioRegistry
from neuromove.transport_protocol.service import TransportProtocolService, default_transport_service
from neuromove.transport_protocol.simulator import Esp32Simulator
from neuromove.transport_protocol.storage import TransportStorage

__all__ = [
    "PROTOCOL_VERSION",
    "SUPPORTED_PROTOCOL_VERSIONS",
    "FRAME_START_DELIMITER",
    "FRAME_END_DELIMITER",
    "MAX_FRAME_PAYLOAD_BYTES",
    "CommandType",
    "TransportCommandStatus",
    "CommandAckStatus",
    "TransportConnectionState",
    "DeviceType",
    "DeviceCapability",
    "DeviceIdentity",
    "ExecutionAuthorization",
    "CommandPayload",
    "CommandEnvelope",
    "CommandAck",
    "CommandNack",
    "TransportFrame",
    "HeartbeatStatus",
    "RetryPolicy",
    "CommandTrace",
    "TransportMetrics",
    "TransportLabStatus",
    "TransportScenarioResult",
    "compute_crc32",
    "verify_crc32",
    "encode_command",
    "decode_command",
    "pack_frame",
    "unpack_frame",
    "validate_authorization",
    "create_command_envelope",
    "create_stop_command",
    "create_cancel_command",
    "TransportAdapter",
    "SimulatedEsp32Adapter",
    "Esp32Simulator",
    "TransportStorage",
    "ScenarioRegistry",
    "TransportProtocolService",
    "default_transport_service",
]
