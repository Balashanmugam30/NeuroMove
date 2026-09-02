"""Comprehensive test suite for Phase 19: ESP32 Protocol & Command Transport Layer."""

from __future__ import annotations

import pytest

from neuromove.domain.enums import SafetyDecision
from neuromove.transport_protocol.ack import (
    is_error_retryable,
)
from neuromove.transport_protocol.checksum import compute_crc32, verify_crc32
from neuromove.transport_protocol.codec import decode_command, encode_command
from neuromove.transport_protocol.commands import (
    create_command_envelope,
    validate_authorization,
)
from neuromove.transport_protocol.framing import (
    FrameChecksumMismatchError,
    FrameDelimiterError,
    FramePayloadSizeError,
    FrameTruncatedError,
    pack_frame,
    unpack_frame,
)
from neuromove.transport_protocol.heartbeat import HeartbeatMonitor
from neuromove.transport_protocol.models import (
    CommandAckStatus,
    RetryPolicy,
    TransportConnectionState,
)
from neuromove.transport_protocol.protocol import (
    PROTOCOL_VERSION,
    is_version_supported,
    negotiate_protocol_version,
)
from neuromove.transport_protocol.reliability import RetryManager
from neuromove.transport_protocol.scenarios import create_mock_authorization
from neuromove.transport_protocol.sequence import SequenceTracker
from neuromove.transport_protocol.service import TransportProtocolService
from neuromove.transport_protocol.simulator import Esp32Simulator


@pytest.fixture
def clean_service() -> TransportProtocolService:
    service = TransportProtocolService()
    service.reset_simulation()
    return service


# ============================================================================
# 1. Protocol Versioning & Constants
# ============================================================================


def test_protocol_version_support():
    assert is_version_supported(PROTOCOL_VERSION)
    assert not is_version_supported("2.0")
    assert not is_version_supported("0.1")


def test_protocol_version_negotiation():
    # Identical version
    compat, ver, reason = negotiate_protocol_version("1.0")
    assert compat is True
    assert ver == "1.0"

    # Incompatible major version
    compat, ver, reason = negotiate_protocol_version("2.0")
    assert compat is False
    assert "Incompatible major version" in reason

    # Malformed version string
    compat, ver, reason = negotiate_protocol_version("invalid_version")
    assert compat is False


# ============================================================================
# 2. Checksum (CRC-32) Integrity
# ============================================================================


def test_crc32_computation_and_verification():
    data = b"NeuroMove Protocol Payload Test"
    checksum = compute_crc32(data)
    assert len(checksum) == 8
    assert verify_crc32(data, checksum)

    # Corrupt single bit
    corrupt = b"NeuroMove Protocol Payload Test!"
    assert not verify_crc32(corrupt, checksum)


# ============================================================================
# 3. Canonical Codec Round-Trip
# ============================================================================


def test_codec_deterministic_round_trip():
    auth = create_mock_authorization()
    envelope = create_command_envelope(auth, device_id="esp32_sim_01", sequence_number=1)

    encoded = encode_command(envelope)
    decoded = decode_command(encoded)

    assert decoded.command_id == envelope.command_id
    assert decoded.message_id == envelope.message_id
    assert decoded.sequence_number == envelope.sequence_number
    assert decoded.payload.intent_class == envelope.payload.intent_class


# ============================================================================
# 4. Framing Pack & Unpack
# ============================================================================


def test_framing_pack_and_unpack():
    auth = create_mock_authorization()
    envelope = create_command_envelope(auth, device_id="esp32_sim_01", sequence_number=1)

    frame_bytes = pack_frame(envelope)
    unpacked_env, meta = unpack_frame(frame_bytes)

    assert unpacked_env.command_id == envelope.command_id
    assert meta.checksum == envelope.checksum
    assert meta.length > 0


def test_framing_delimiter_error():
    corrupt_start = b"\x00\x00" + b"\x00" * 20
    with pytest.raises(FrameDelimiterError):
        unpack_frame(corrupt_start)


def test_framing_truncated_error():
    short_frame = b"\xaa\x55\x01"
    with pytest.raises(FrameTruncatedError):
        unpack_frame(short_frame)


def test_framing_checksum_mismatch():
    auth = create_mock_authorization()
    envelope = create_command_envelope(auth, device_id="esp32_sim_01", sequence_number=1)
    frame_bytes = pack_frame(envelope)

    # Corrupt payload byte
    corrupt = bytearray(frame_bytes)
    corrupt[20] = (corrupt[20] + 1) % 256
    with pytest.raises(FrameChecksumMismatchError):
        unpack_frame(bytes(corrupt))


def test_framing_payload_size_error():
    auth = create_mock_authorization()
    large_params = {"data": "A" * 1500}
    auth.intent_class = "BIG"
    envelope = create_command_envelope(
        auth, device_id="esp32_sim_01", sequence_number=1, parameters=large_params
    )

    with pytest.raises(FramePayloadSizeError):
        pack_frame(envelope)


# ============================================================================
# 5. Authorization Boundary Invariants (Phase 17 Handshake)
# ============================================================================


def test_authorization_valid():
    auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
    is_valid, code, msg = validate_authorization(auth)
    assert is_valid is True
    assert code == "AUTHORIZED"


@pytest.mark.parametrize(
    "decision",
    [
        SafetyDecision.DENIED,
        SafetyDecision.HELD,
        SafetyDecision.EMERGENCY_STOP,
        SafetyDecision.LOCKED_OUT,
        SafetyDecision.INVALID,
        SafetyDecision.BLOCKED,
        SafetyDecision.STOP,
    ],
)
def test_authorization_non_authorized_rejected(decision):
    auth = create_mock_authorization(decision=decision)
    is_valid, code, msg = validate_authorization(auth)
    assert is_valid is False
    assert code == "UNAUTHORIZED_DECISION"


def test_authorization_expired_rejected():
    auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED, expired=True)
    is_valid, code, msg = validate_authorization(auth)
    assert is_valid is False
    assert code == "AUTHORIZATION_EXPIRED"


def test_authorization_missing_fields_rejected():
    auth = create_mock_authorization()
    auth.subject_id = ""
    is_valid, code, msg = validate_authorization(auth)
    assert is_valid is False
    assert code == "MISSING_SUBJECT_ID"


# ============================================================================
# 6. Monotonic Sequence Control
# ============================================================================


def test_sequence_tracker_monotonicity():
    tracker = SequenceTracker()
    assert tracker.allocate_next_tx() == 1
    assert tracker.allocate_next_tx() == 2
    assert tracker.allocate_next_tx() == 3

    # Incoming RX validation
    assert tracker.validate_incoming_rx(1).is_valid is True
    tracker.record_rx(1)

    assert tracker.validate_incoming_rx(2).is_valid is True
    tracker.record_rx(2)

    # Gap detection
    res_gap = tracker.validate_incoming_rx(5)
    assert res_gap.is_valid is False
    assert res_gap.status == "GAP"
    assert res_gap.gap_count == 2

    # Duplicate detection
    res_dup = tracker.validate_incoming_rx(1)
    assert res_dup.is_valid is False
    assert res_dup.status == "DUPLICATE"


# ============================================================================
# 7. ACK / NACK Classification & Reliability
# ============================================================================


def test_retry_classification():
    assert is_error_retryable("TIMEOUT") is True
    assert is_error_retryable("TRANSPORT_DROP") is True
    assert is_error_retryable("CONNECTION_RESET") is True

    assert is_error_retryable("AUTHORIZATION_EXPIRED") is False
    assert is_error_retryable("AUTHORIZATION_DENIED") is False
    assert is_error_retryable("CHECKSUM_MISMATCH") is False
    assert is_error_retryable("SESSION_MISMATCH") is False


def test_retry_manager_bounded_retries():
    manager = RetryManager(policy=RetryPolicy(max_attempts=3))
    auth = create_mock_authorization()
    envelope = create_command_envelope(auth, device_id="esp32_sim_01", sequence_number=1)

    assert manager.should_retry(envelope, attempt_count=1, error_code="TIMEOUT") is True
    assert manager.should_retry(envelope, attempt_count=2, error_code="TIMEOUT") is True
    assert manager.should_retry(envelope, attempt_count=3, error_code="TIMEOUT") is False
    assert manager.should_retry(envelope, attempt_count=1, error_code="CHECKSUM_MISMATCH") is False


def test_retry_preserves_command_id():
    manager = RetryManager()
    auth = create_mock_authorization()
    envelope = create_command_envelope(auth, device_id="esp32_sim_01", sequence_number=1)

    retry_env = manager.prepare_retry_envelope(
        envelope, new_message_id="msg_retry_99", new_sequence_number=2
    )
    assert retry_env.command_id == envelope.command_id
    assert retry_env.message_id == "msg_retry_99"
    assert retry_env.sequence_number == 2
    assert retry_env.flags.get("retry") is True


# ============================================================================
# 8. Heartbeat & Fail-Closed Link Health
# ============================================================================


def test_heartbeat_monitor_lifecycle():
    monitor = HeartbeatMonitor()
    monitor.set_connection_state(TransportConnectionState.CONNECTED)
    assert monitor.is_link_healthy() is True

    # 1 missed
    assert monitor.record_missed_heartbeat() == TransportConnectionState.CONNECTED
    # 2 missed -> DEGRADED
    assert monitor.record_missed_heartbeat() == TransportConnectionState.DEGRADED
    # 3 missed -> STALE
    assert monitor.record_missed_heartbeat() == TransportConnectionState.STALE
    assert monitor.is_link_healthy() is False

    # Receipt restores to CONNECTED
    monitor.record_pong_received()
    assert monitor.get_status().link_state == TransportConnectionState.CONNECTED
    assert monitor.is_link_healthy() is True


# ============================================================================
# 9. Simulator Endpoint Semantics & Idempotency
# ============================================================================


def test_simulator_execution_and_duplicate():
    sim = Esp32Simulator()
    sim.negotiate("1.0", "sess-01")

    auth = create_mock_authorization(session_id="sess-01")
    envelope = create_command_envelope(auth, device_id=sim.device_id, sequence_number=1)
    frame_bytes = pack_frame(envelope)

    # First receive: ACCEPTED
    ack1 = sim.process_incoming_frame(frame_bytes)
    assert ack1.status == CommandAckStatus.COMMAND_ACCEPTED
    assert ack1.reason == "SIMULATED_EXECUTED"

    # Duplicate receive with SAME command_id: DUPLICATE
    ack2 = sim.process_incoming_frame(frame_bytes)
    assert ack2.status == CommandAckStatus.COMMAND_DUPLICATE


def test_simulator_session_mismatch():
    sim = Esp32Simulator()
    sim.negotiate("1.0", "sess-01")

    # Command from different session
    auth = create_mock_authorization(session_id="sess-OTHER")
    envelope = create_command_envelope(auth, device_id=sim.device_id, sequence_number=1)
    frame_bytes = pack_frame(envelope)

    nack = sim.process_incoming_frame(frame_bytes)
    assert nack.error_code == "SESSION_MISMATCH"


# ============================================================================
# 10. Canonical Scenarios A through T
# ============================================================================


@pytest.mark.parametrize(
    "scenario_id",
    [
        "SCENARIO_A",
        "SCENARIO_B",
        "SCENARIO_C",
        "SCENARIO_D",
        "SCENARIO_E",
        "SCENARIO_F",
        "SCENARIO_G",
        "SCENARIO_H",
        "SCENARIO_I",
        "SCENARIO_J",
        "SCENARIO_K",
        "SCENARIO_L",
        "SCENARIO_M",
        "SCENARIO_N",
        "SCENARIO_O",
        "SCENARIO_P",
        "SCENARIO_Q",
        "SCENARIO_R",
        "SCENARIO_S",
        "SCENARIO_T",
    ],
)
def test_all_canonical_scenarios(clean_service: TransportProtocolService, scenario_id: str):
    result = clean_service.scenario_registry.run_scenario(scenario_id)
    assert result.passed is True, f"Scenario {scenario_id} failed: {result}"
