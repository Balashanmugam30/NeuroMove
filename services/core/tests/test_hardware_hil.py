"""Comprehensive Backend Unit & Integration Tests for Phase 20 Hardware-in-the-Loop."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from neuromove.domain.enums import SafetyDecision
from neuromove.hardware_hil.emulator import Esp32ProtocolEmulator
from neuromove.hardware_hil.models import (
    HardwareConnectionState,
    HardwareEndpointMode,
)
from neuromove.hardware_hil.ports import discover_serial_ports, validate_port_settings
from neuromove.hardware_hil.scenarios import HILScenarioRegistry
from neuromove.hardware_hil.service import HardwareHilService
from neuromove.hardware_hil.state_machine import HardwareConnectionStateMachine
from neuromove.hardware_hil.virtual_adapter import VirtualSerialAdapter
from neuromove.hardware_hil.virtual_serial import VirtualSerialPair
from neuromove.transport_protocol.commands import create_command_envelope
from neuromove.transport_protocol.framing import pack_frame
from neuromove.transport_protocol.models import (
    CommandAckStatus,
    CommandEnvelope,
    CommandPayload,
    CommandType,
    ExecutionAuthorization,
)


def create_test_auth(
    decision: SafetyDecision = SafetyDecision.AUTHORIZED,
    expires_delta_sec: int = 10,
    intent_class: str = "MOVE_FORWARD",
    session_id: str = "sess_hw_01",
) -> ExecutionAuthorization:
    now = datetime.now(UTC)
    return ExecutionAuthorization(
        authorization_id="auth_hw_test_01",
        intent_id="int_hw_test_01",
        intent_class=intent_class,
        decision=decision,
        policy_version="1.0",
        evaluation_id="eval_hw_test_01",
        model_version_id="csp_lda_v1",
        subject_id="sub-01",
        session_id=session_id,
        issued_at=now.isoformat(),
        expires_at=(now + timedelta(seconds=expires_delta_sec)).isoformat(),
        reason="Automated HIL test verification",
    )


# ============================================================================
# 1. Port Discovery & Settings Validation Tests
# ============================================================================


def test_port_discovery() -> None:
    ports = discover_serial_ports()
    assert len(ports) > 0
    assert any(p.port == "VIRTUAL_COM_01" for p in ports)
    assert any(p.port == "SIMULATED_ENDPOINT" for p in ports)
    assert all(not p.is_open for p in ports)


def test_port_validation() -> None:
    settings = validate_port_settings("COM3", baud_rate=115200, read_timeout_ms=500)
    assert settings["port"] == "COM3"
    assert settings["baud_rate"] == 115200

    with pytest.raises(ValueError, match="Invalid baud rate"):
        validate_port_settings("COM3", baud_rate=12345)

    with pytest.raises(ValueError, match="read_timeout_ms"):
        validate_port_settings("COM3", read_timeout_ms=10)


# ============================================================================
# 2. State Machine Transition Tests
# ============================================================================


def test_state_machine_valid_transitions() -> None:
    sm = HardwareConnectionStateMachine()
    assert sm.current_state == HardwareConnectionState.DISCONNECTED

    sm.transition_to(HardwareConnectionState.CONNECTING)
    assert sm.current_state == HardwareConnectionState.CONNECTING

    sm.transition_to(HardwareConnectionState.NEGOTIATING)
    assert sm.current_state == HardwareConnectionState.NEGOTIATING

    sm.transition_to(HardwareConnectionState.READY)
    assert sm.current_state == HardwareConnectionState.READY

    sm.transition_to(HardwareConnectionState.DEGRADED)
    assert sm.current_state == HardwareConnectionState.DEGRADED

    sm.transition_to(HardwareConnectionState.STALE)
    assert sm.current_state == HardwareConnectionState.STALE

    sm.transition_to(HardwareConnectionState.RECONNECTING)
    assert sm.current_state == HardwareConnectionState.RECONNECTING


def test_state_machine_illegal_transition() -> None:
    sm = HardwareConnectionStateMachine()
    with pytest.raises(ValueError, match="Illegal hardware connection state transition"):
        sm.transition_to(HardwareConnectionState.READY)


# ============================================================================
# 3. Virtual Serial Channel Tests
# ============================================================================


def test_virtual_serial_duplex_communication() -> None:
    pair = VirtualSerialPair(port_name="TEST_PORT", timeout_s=0.2)
    test_bytes = b"\xaa\x55TEST_DATA\x55\xaa"

    pair.host_to_device.write(test_bytes)
    received = pair.host_to_device.read_all()
    assert received == test_bytes

    pair.close()
    with pytest.raises(ConnectionError):
        pair.host_to_device.write(b"data")


# ============================================================================
# 4. Protocol Emulator Tests
# ============================================================================


def test_emulator_handshake_and_identity() -> None:
    emulator = Esp32ProtocolEmulator()
    success, version, reason = emulator.negotiate("1.0", "sess_hw_01")
    assert success is True
    assert version == "1.0"
    assert emulator.connection_state == HardwareConnectionState.READY

    info = emulator.get_device_info()
    assert info.device_type == "ESP32_HIL_ENDPOINT"
    assert "COMMAND_RECEIVE" in info.capabilities
    assert "SAFE_STOP" in info.capabilities


def test_emulator_cold_reboot() -> None:
    emulator = Esp32ProtocolEmulator()
    old_boot = emulator.boot_id
    new_boot = emulator.reboot()
    assert old_boot != new_boot
    assert emulator.connection_state == HardwareConnectionState.DISCONNECTED


def test_emulator_device_side_expiry() -> None:
    emulator = Esp32ProtocolEmulator()
    emulator.negotiate("1.0", "sess_hw_01")

    # Expired authorization
    auth = create_test_auth(expires_delta_sec=-10)
    envelope = CommandEnvelope(
        protocol_version="1.0",
        message_id="msg_exp_01",
        command_id="cmd_exp_01",
        sequence_number=1,
        device_id="esp32_sim_01",
        issued_at=auth.issued_at,
        expires_at=auth.expires_at,
        payload=CommandPayload(
            intent_class="MOVE_FORWARD",
            parameters={},
            metadata={},
        ),
    )
    frame_bytes = pack_frame(envelope)

    nack = emulator.process_incoming_frame(frame_bytes)
    assert nack.error_code == "EXPIRED_AUTHORIZATION"


def test_emulator_idempotent_duplicate() -> None:
    emulator = Esp32ProtocolEmulator()
    emulator.negotiate("1.0", "sess_hw_01")

    auth = create_test_auth()
    envelope = create_command_envelope(
        auth=auth,
        device_id="esp32_sim_01",
        sequence_number=1,
        command_id="cmd_dup_01",
    )
    frame_bytes = pack_frame(envelope)

    ack1 = emulator.process_incoming_frame(frame_bytes)
    assert ack1.status == CommandAckStatus.COMMAND_ACCEPTED

    ack2 = emulator.process_incoming_frame(frame_bytes)
    assert ack2.status == CommandAckStatus.COMMAND_DUPLICATE


# ============================================================================
# 5. Virtual Adapter Tests
# ============================================================================


def test_virtual_adapter_send_frame() -> None:
    adapter = VirtualSerialAdapter()
    adapter.connect()
    adapter.negotiate("1.0", "sess_hw_01")

    auth = create_test_auth()
    envelope = create_command_envelope(
        auth=auth,
        device_id="esp32_sim_01",
        sequence_number=1,
        command_id="cmd_virt_01",
    )
    frame_bytes = pack_frame(envelope)

    ack = adapter.send_frame(frame_bytes)
    assert ack.status == CommandAckStatus.COMMAND_ACCEPTED
    assert adapter.ping() > 0


# ============================================================================
# 6. Service & Safety Gate Proof Tests
# ============================================================================


def test_service_mode_switching() -> None:
    service = HardwareHilService()
    assert service.active_mode == HardwareEndpointMode.SIMULATOR

    # Switch to Virtual Serial
    success = service.set_endpoint_mode(HardwareEndpointMode.VIRTUAL_SERIAL, port="VIRTUAL_COM_01")
    assert success is True
    assert service.active_mode == HardwareEndpointMode.VIRTUAL_SERIAL
    assert service.state_machine.current_state == HardwareConnectionState.READY

    # Switch back to Simulator
    success = service.set_endpoint_mode(HardwareEndpointMode.SIMULATOR)
    assert success is True
    assert service.active_mode == HardwareEndpointMode.SIMULATOR


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
def test_service_non_authorized_rejection_proof(decision: SafetyDecision) -> None:
    service = HardwareHilService()
    auth = create_test_auth(decision=decision)

    result = service.send_command(
        command_type=CommandType.EXECUTE_INTENT,
        intent_class="MOVE_FORWARD",
        authorization=auth,
    )
    assert result["status"] == "COMMAND_REJECTED"
    assert result["transmission_count"] == 0
    assert result["command_id"] is None


def test_service_authorized_command_execution() -> None:
    service = HardwareHilService()
    auth = create_test_auth(
        decision=SafetyDecision.AUTHORIZED,
        session_id=service.active_session_id or "sess_hw_01",
    )

    result = service.send_command(
        command_type=CommandType.EXECUTE_INTENT,
        intent_class="MOVE_FORWARD",
        authorization=auth,
    )
    assert result["status"] == "COMMAND_ACCEPTED"
    assert result["transmission_count"] == 1
    assert result["command_id"] is not None


def test_service_heartbeat_lifecycle() -> None:
    service = HardwareHilService()
    rtt = service.ping_heartbeat()
    assert rtt > 0
    health = service.get_health()
    assert health.heartbeat_healthy is True
    assert health.missed_heartbeats == 0


# ============================================================================
# 7. Canonical Scenarios A through T Test Matrix
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
def test_all_canonical_hil_scenarios(scenario_id: str) -> None:
    registry = HILScenarioRegistry()
    result = registry.run_scenario(scenario_id)
    assert result.passed is True, f"Scenario {scenario_id} failed: {result.failure_reason}"
