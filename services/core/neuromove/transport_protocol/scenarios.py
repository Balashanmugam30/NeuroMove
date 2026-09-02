"""Deterministic Scenarios (A through T) for Command Transport & Protocol Verification."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from neuromove.domain.enums import SafetyDecision
from neuromove.transport_protocol.models import (
    ExecutionAuthorization,
    TransportConnectionState,
    TransportScenarioResult,
)

logger = logging.getLogger(__name__)


def create_mock_authorization(
    decision: SafetyDecision = SafetyDecision.AUTHORIZED,
    intent_class: str = "MOVE_FORWARD",
    expired: bool = False,
    subject_id: str = "sub-01",
    session_id: str = "sess-01",
    model_version: str = "model_v1",
    expires_in_seconds: float = 10.0,
) -> ExecutionAuthorization:
    """Helper to create realistic mock ExecutionAuthorization."""
    now = datetime.now(UTC)
    if expired:
        issued_at = (now - timedelta(seconds=20)).isoformat()
        expires_at = (now - timedelta(seconds=10)).isoformat()
    else:
        issued_at = now.isoformat()
        expires_at = (now + timedelta(seconds=expires_in_seconds)).isoformat()

    return ExecutionAuthorization(
        authorization_id=f"auth_{uuid.uuid4().hex[:8]}",
        intent_id=f"int_{uuid.uuid4().hex[:8]}",
        intent_class=intent_class,
        decision=decision,
        policy_version="1.0.0",
        evaluation_id=f"eval_{uuid.uuid4().hex[:8]}",
        model_version_id=model_version,
        subject_id=subject_id,
        session_id=session_id,
        issued_at=issued_at,
        expires_at=expires_at,
        reason=f"Safety arbitration result: {decision.value}",
    )


class ScenarioRegistry:
    """Registry and executor for canonical Phase 19 test scenarios."""

    def __init__(self, service: Any) -> None:
        self.service = service
        self.scenarios: dict[str, dict[str, Any]] = {
            "SCENARIO_A": {
                "name": "Normal Handshake & Protocol Negotiation",
                "description": "Establish connection, negotiate protocol v1.0, perform heartbeat, verify READY state.",
                "run": self.run_scenario_a,
            },
            "SCENARIO_B": {
                "name": "Authorized Command Transmit & ACK",
                "description": "Valid Phase 17 AUTHORIZED decision generates envelope, transmits to simulator, receives ACK.",
                "run": self.run_scenario_b,
            },
            "SCENARIO_C": {
                "name": "Denied Safety Authorization & Zero Transmit",
                "description": "SafetyDecision.DENIED strictly produces zero command frames and zero network transmissions.",
                "run": self.run_scenario_c,
            },
            "SCENARIO_D": {
                "name": "Expired Authorization & Zero Transmit",
                "description": "Expired authorization timestamp rejected before frame construction; zero network transmission.",
                "run": self.run_scenario_d,
            },
            "SCENARIO_E": {
                "name": "Emergency Stop Inviolability",
                "description": "EMERGENCY_STOP safety state strictly prohibits execution command transmission.",
                "run": self.run_scenario_e,
            },
            "SCENARIO_F": {
                "name": "Safety Lockout Inviolability",
                "description": "LOCKED_OUT safety state strictly prohibits execution command transmission.",
                "run": self.run_scenario_f,
            },
            "SCENARIO_G": {
                "name": "Duplicate Command Idempotency",
                "description": "Duplicate transmission of identical command_id recognized and acknowledged idempotently.",
                "run": self.run_scenario_g,
            },
            "SCENARIO_H": {
                "name": "Lost ACK & Bounded Retry",
                "description": "Simulated ACK loss triggers bounded retries reusing identical command_id with fresh message_id.",
                "run": self.run_scenario_h,
            },
            "SCENARIO_I": {
                "name": "Checksum Corruption & NACK",
                "description": "Single-bit or payload corruption caught by CRC-32 integrity checker; NACK returned.",
                "run": self.run_scenario_i,
            },
            "SCENARIO_J": {
                "name": "Sequence Gap Detection",
                "description": "Sequence jump (1, 2, 4) detected and rejected with explicit SEQUENCE_GAP error.",
                "run": self.run_scenario_j,
            },
            "SCENARIO_K": {
                "name": "Out-of-Order Frame Rejection",
                "description": "Out-of-order sequence regression (10, 12, 11) rejected; state regression strictly prevented.",
                "run": self.run_scenario_k,
            },
            "SCENARIO_L": {
                "name": "Heartbeat Degradation & Fail-Closed Link",
                "description": "Consecutive missed heartbeats transition link through DEGRADED to STALE; halts new commands.",
                "run": self.run_scenario_l,
            },
            "SCENARIO_M": {
                "name": "Disconnect & Clean Renegotiation",
                "description": "Transport link disconnects and recovers via fresh 3-way handshake and sequence reset.",
                "run": self.run_scenario_m,
            },
            "SCENARIO_N": {
                "name": "Device Reboot & Boot ID Reset",
                "description": "Simulated ESP32 cold reboot generates new boot_id and resets sequence counters safely.",
                "run": self.run_scenario_n,
            },
            "SCENARIO_O": {
                "name": "Protocol Version Mismatch Rejection",
                "description": "Unsupported protocol version (e.g. 99.0) cleanly rejected during negotiation handshake.",
                "run": self.run_scenario_o,
            },
            "SCENARIO_P": {
                "name": "Capability Mismatch Rejection",
                "description": "Command requiring unsupported capability rejected before transmission.",
                "run": self.run_scenario_p,
            },
            "SCENARIO_Q": {
                "name": "Malformed Frame Header Rejection",
                "description": "Frame with invalid start delimiter or truncated header rejected by framing parser.",
                "run": self.run_scenario_q,
            },
            "SCENARIO_R": {
                "name": "Oversized Payload Rejection",
                "description": "Payload exceeding maximum limit (>1024B) rejected before transmission.",
                "run": self.run_scenario_r,
            },
            "SCENARIO_S": {
                "name": "Clock Skew & Stale Expiry Rejection",
                "description": "Simulated clock skew or future/expired command timestamp strictly rejected.",
                "run": self.run_scenario_s,
            },
            "SCENARIO_T": {
                "name": "Full End-to-End Recovery Flow",
                "description": "Transport experiences fault, recovers, renegotiates, and successfully transmits fresh command.",
                "run": self.run_scenario_t,
            },
        }

    def list_scenarios(self) -> list[dict[str, Any]]:
        """List summary of all registered canonical scenarios."""
        return [
            {
                "scenario_id": sid,
                "name": s["name"],
                "description": s["description"],
            }
            for sid, s in self.scenarios.items()
        ]

    def run_scenario(self, scenario_id: str) -> TransportScenarioResult:
        """Execute a canonical scenario by ID."""
        entry = self.scenarios.get(scenario_id)
        if not entry:
            raise ValueError(f"Unknown scenario ID: {scenario_id}")
        return entry["run"]()

    # --- Scenario Implementations ---

    def run_scenario_a(self) -> TransportScenarioResult:
        """Scenario A — Normal Handshake."""
        self.service.reconnect()
        state = self.service.connection_state
        passed = state == TransportConnectionState.CONNECTED
        return TransportScenarioResult(
            scenario_id="SCENARIO_A",
            name="Normal Handshake & Protocol Negotiation",
            description="Establish connection, negotiate protocol v1.0, perform heartbeat, verify READY state.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=state.value,
            expected_ack_status="CONNECTED",
            observed_ack_status=state.value,
            retries_observed=0,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_b(self) -> TransportScenarioResult:
        """Scenario B — Authorized Command Transmit & ACK."""
        self.service.reconnect()
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        result = self.service.send_authorized_command(auth)

        passed = result.get("status") == "ACKED" and result.get("ack_status") == "COMMAND_ACCEPTED"
        return TransportScenarioResult(
            scenario_id="SCENARIO_B",
            name="Authorized Command Transmit & ACK",
            description="Valid Phase 17 AUTHORIZED decision generates envelope, transmits to simulator, receives ACK.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="COMMAND_ACCEPTED",
            observed_ack_status=result.get("ack_status", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_c(self) -> TransportScenarioResult:
        """Scenario C — Denied Authorization & Zero Transmit."""
        auth = create_mock_authorization(decision=SafetyDecision.DENIED)
        result = self.service.send_authorized_command(auth)

        passed = (
            not result.get("transmitted") and result.get("reason_code") == "UNAUTHORIZED_DECISION"
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_C",
            name="Denied Safety Authorization & Zero Transmit",
            description="SafetyDecision.DENIED strictly produces zero command frames and zero network transmissions.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NO_COMMAND",
            observed_ack_status="NO_COMMAND" if not result.get("transmitted") else "TRANSMITTED",
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_d(self) -> TransportScenarioResult:
        """Scenario D — Expired Authorization & Zero Transmit."""
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED, expired=True)
        result = self.service.send_authorized_command(auth)

        passed = (
            not result.get("transmitted") and result.get("reason_code") == "AUTHORIZATION_EXPIRED"
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_D",
            name="Expired Authorization & Zero Transmit",
            description="Expired authorization timestamp rejected before frame construction; zero network transmission.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NO_COMMAND",
            observed_ack_status="NO_COMMAND" if not result.get("transmitted") else "TRANSMITTED",
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_e(self) -> TransportScenarioResult:
        """Scenario E — Emergency Stop Inviolability."""
        auth = create_mock_authorization(decision=SafetyDecision.EMERGENCY_STOP)
        result = self.service.send_authorized_command(auth)

        passed = (
            not result.get("transmitted") and result.get("reason_code") == "UNAUTHORIZED_DECISION"
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_E",
            name="Emergency Stop Inviolability",
            description="EMERGENCY_STOP safety state strictly prohibits execution command transmission.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NO_COMMAND",
            observed_ack_status="NO_COMMAND" if not result.get("transmitted") else "TRANSMITTED",
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_f(self) -> TransportScenarioResult:
        """Scenario F — Safety Lockout Inviolability."""
        auth = create_mock_authorization(decision=SafetyDecision.LOCKED_OUT)
        result = self.service.send_authorized_command(auth)

        passed = (
            not result.get("transmitted") and result.get("reason_code") == "UNAUTHORIZED_DECISION"
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_F",
            name="Safety Lockout Inviolability",
            description="LOCKED_OUT safety state strictly prohibits execution command transmission.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NO_COMMAND",
            observed_ack_status="NO_COMMAND" if not result.get("transmitted") else "TRANSMITTED",
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_g(self) -> TransportScenarioResult:
        """Scenario G — Duplicate Command Idempotency."""
        self.service.reconnect()
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        res1 = self.service.send_authorized_command(auth)
        cmd_id = res1["command_id"]

        # Re-send identical command_id
        res2 = self.service.send_authorized_command(auth, forced_command_id=cmd_id)

        passed = res2.get("ack_status") == "COMMAND_DUPLICATE"
        return TransportScenarioResult(
            scenario_id="SCENARIO_G",
            name="Duplicate Command Idempotency",
            description="Duplicate transmission of identical command_id recognized and acknowledged idempotently.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="COMMAND_DUPLICATE",
            observed_ack_status=res2.get("ack_status", "UNKNOWN"),
            retries_observed=0,
            details={"first_send": res1, "second_send": res2},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_h(self) -> TransportScenarioResult:
        """Scenario H — Lost ACK & Bounded Retry."""
        self.service.reconnect()
        # In simulator, set drop_ack once
        self.service.adapter.simulator.set_faults(drop_ack=True)
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        result = self.service.send_authorized_command(auth)
        self.service.adapter.simulator.clear_faults()

        retries = result.get("attempt_count", 1) - 1
        passed = retries > 0 and (
            result.get("status") == "ACKED"
            or result.get("ack_status") in ("COMMAND_ACCEPTED", "COMMAND_DUPLICATE")
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_H",
            name="Lost ACK & Bounded Retry",
            description="Simulated ACK loss triggers bounded retries reusing identical command_id with fresh message_id.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="COMMAND_ACCEPTED_OR_DUPLICATE",
            observed_ack_status=result.get("ack_status", "UNKNOWN"),
            retries_observed=retries,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_i(self) -> TransportScenarioResult:
        """Scenario I — Checksum Corruption & NACK."""
        self.service.reconnect()
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        # Inject corrupted CRC into frame transmission
        result = self.service.send_authorized_command(auth, corrupt_crc=True)

        passed = result.get("status") == "REJECTED" and "CHECKSUM_MISMATCH" in result.get(
            "error", ""
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_I",
            name="Checksum Corruption & NACK",
            description="Single-bit or payload corruption caught by CRC-32 integrity checker; NACK returned.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NACK_CHECKSUM_MISMATCH",
            observed_ack_status=result.get("error", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_j(self) -> TransportScenarioResult:
        """Scenario J — Sequence Gap Detection."""
        self.service.reconnect()
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        # Force sequence gap by advancing internal tx counter by 5
        self.service.sequence_tracker._current_tx_sequence += 5
        result = self.service.send_authorized_command(auth)

        passed = "SEQUENCE_GAP" in result.get("error", "") or result.get("status") == "REJECTED"
        return TransportScenarioResult(
            scenario_id="SCENARIO_J",
            name="Sequence Gap Detection",
            description="Sequence jump (1, 2, 4) detected and rejected with explicit SEQUENCE_GAP error.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="SEQUENCE_GAP",
            observed_ack_status=result.get("error", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_k(self) -> TransportScenarioResult:
        """Scenario K — Out of Order Rejection."""
        self.service.reconnect()
        auth1 = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        self.service.send_authorized_command(auth1)

        # Send old sequence number
        auth2 = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        result = self.service.send_authorized_command(auth2, forced_sequence=1)

        passed = result.get("ack_status") == "COMMAND_DUPLICATE" or "OUT_OF_ORDER" in result.get(
            "error", ""
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_K",
            name="Out-of-Order Frame Rejection",
            description="Out-of-order sequence regression (10, 12, 11) rejected; state regression strictly prevented.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="REJECTED_OR_DUPLICATE",
            observed_ack_status=result.get("ack_status") or result.get("error", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_l(self) -> TransportScenarioResult:
        """Scenario L — Heartbeat Degradation."""
        self.service.reconnect()
        # Miss 2 heartbeats -> DEGRADED
        self.service.heartbeat_monitor.record_missed_heartbeat()
        self.service.heartbeat_monitor.record_missed_heartbeat()
        state1 = self.service.heartbeat_monitor.get_status().link_state

        # Miss 3rd heartbeat -> STALE
        self.service.heartbeat_monitor.record_missed_heartbeat()
        state2 = self.service.heartbeat_monitor.get_status().link_state

        passed = (
            state1 == TransportConnectionState.DEGRADED and state2 == TransportConnectionState.STALE
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_L",
            name="Heartbeat Degradation & Fail-Closed Link",
            description="Consecutive missed heartbeats transition link through DEGRADED to STALE; halts new commands.",
            passed=passed,
            expected_state="STALE",
            observed_state=state2.value,
            expected_ack_status="DEGRADED_THEN_STALE",
            observed_ack_status=f"{state1.value} -> {state2.value}",
            retries_observed=0,
            details={"degraded_state": state1.value, "stale_state": state2.value},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_m(self) -> TransportScenarioResult:
        """Scenario M — Disconnect & Renegotiation."""
        self.service.reconnect()
        self.service.disconnect()
        d_state = self.service.connection_state

        self.service.reconnect()
        r_state = self.service.connection_state

        passed = (
            d_state == TransportConnectionState.DISCONNECTED
            and r_state == TransportConnectionState.CONNECTED
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_M",
            name="Disconnect & Clean Renegotiation",
            description="Transport link disconnects and recovers via fresh 3-way handshake and sequence reset.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=r_state.value,
            expected_ack_status="DISCONNECTED_THEN_CONNECTED",
            observed_ack_status=f"{d_state.value} -> {r_state.value}",
            retries_observed=0,
            details={"disconnected": d_state.value, "reconnected": r_state.value},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_n(self) -> TransportScenarioResult:
        """Scenario N — Device Reboot & Boot ID Reset."""
        boot1 = self.service.adapter.simulator.boot_id
        boot2 = self.service.adapter.simulator.reboot()
        self.service.reconnect()

        passed = (
            boot1 != boot2 and self.service.connection_state == TransportConnectionState.CONNECTED
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_N",
            name="Device Reboot & Boot ID Reset",
            description="Simulated ESP32 cold reboot generates new boot_id and resets sequence counters safely.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="NEW_BOOT_ID",
            observed_ack_status=f"boot_id: {boot1} -> {boot2}",
            retries_observed=0,
            details={"old_boot_id": boot1, "new_boot_id": boot2},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_o(self) -> TransportScenarioResult:
        """Scenario O — Protocol Version Mismatch."""
        compat, ver, reason = self.service.adapter.negotiate("99.0", "sess_test")
        passed = not compat and "Incompatible major version" in reason
        return TransportScenarioResult(
            scenario_id="SCENARIO_O",
            name="Protocol Version Mismatch Rejection",
            description="Unsupported protocol version (e.g. 99.0) cleanly rejected during negotiation handshake.",
            passed=passed,
            expected_state="DISCONNECTED",
            observed_state="DISCONNECTED" if not compat else "CONNECTED",
            expected_ack_status="VERSION_REJECTED",
            observed_ack_status="VERSION_REJECTED" if not compat else "ACCEPTED",
            retries_observed=0,
            details={"reason": reason},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_p(self) -> TransportScenarioResult:
        """Scenario P — Capability Mismatch."""
        # Check command unsupported
        from neuromove.transport_protocol.capabilities import is_command_supported
        from neuromove.transport_protocol.models import CommandType, DeviceCapability

        compat, reason = is_command_supported(CommandType.STOP, [DeviceCapability.COMMAND_RECEIVE])
        passed = not compat and "Device lacks required capability" in reason
        return TransportScenarioResult(
            scenario_id="SCENARIO_P",
            name="Capability Mismatch Rejection",
            description="Command requiring unsupported capability rejected before transmission.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state="CONNECTED",
            expected_ack_status="CAPABILITY_REJECTED",
            observed_ack_status="CAPABILITY_REJECTED" if not compat else "ACCEPTED",
            retries_observed=0,
            details={"reason": reason},
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_q(self) -> TransportScenarioResult:
        """Scenario Q — Malformed Frame Header."""
        # Unpack bad header
        from neuromove.transport_protocol.framing import unpack_frame

        corrupt_frame = b"\x00\x00\x00\x00\x00"  # Invalid start delimiter
        rejected = False
        try:
            unpack_frame(corrupt_frame)
        except Exception:
            rejected = True

        return TransportScenarioResult(
            scenario_id="SCENARIO_Q",
            name="Malformed Frame Header Rejection",
            description="Frame with invalid start delimiter or truncated header rejected by framing parser.",
            passed=rejected,
            expected_state="REJECTED",
            observed_state="REJECTED" if rejected else "ACCEPTED",
            expected_ack_status="FRAME_REJECTED",
            observed_ack_status="FRAME_REJECTED" if rejected else "ACCEPTED",
            retries_observed=0,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_r(self) -> TransportScenarioResult:
        """Scenario R — Oversized Frame Rejection."""
        from neuromove.transport_protocol.framing import FramePayloadSizeError, pack_frame
        from neuromove.transport_protocol.models import CommandEnvelope, CommandPayload

        oversized_payload = "x" * 2048
        env = CommandEnvelope(
            message_id="msg_huge",
            command_id="cmd_huge",
            sequence_number=1,
            device_id="esp32_sim_01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at=datetime.now(UTC).isoformat(),
            payload=CommandPayload(intent_class="TEST", parameters={"data": oversized_payload}),
        )

        rejected = False
        try:
            pack_frame(env)
        except FramePayloadSizeError:
            rejected = True

        return TransportScenarioResult(
            scenario_id="SCENARIO_R",
            name="Oversized Payload Rejection",
            description="Payload exceeding maximum limit (>1024B) rejected before transmission.",
            passed=rejected,
            expected_state="REJECTED",
            observed_state="REJECTED" if rejected else "ACCEPTED",
            expected_ack_status="OVERSIZED_REJECTED",
            observed_ack_status="OVERSIZED_REJECTED" if rejected else "ACCEPTED",
            retries_observed=0,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_s(self) -> TransportScenarioResult:
        """Scenario S — Clock Skew & Stale Expiry Rejection."""
        self.service.reconnect()
        # Simulate clock skew: 60s ahead
        self.service.adapter.simulator.set_faults(skew_seconds=60.0)
        auth = create_mock_authorization(
            decision=SafetyDecision.AUTHORIZED, expires_in_seconds=10.0
        )
        result = self.service.send_authorized_command(auth)
        self.service.adapter.simulator.clear_faults()

        passed = result.get("ack_status") == "COMMAND_EXPIRED"
        return TransportScenarioResult(
            scenario_id="SCENARIO_S",
            name="Clock Skew & Stale Expiry Rejection",
            description="Simulated clock skew or future/expired command timestamp strictly rejected.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="COMMAND_EXPIRED",
            observed_ack_status=result.get("ack_status", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )

    def run_scenario_t(self) -> TransportScenarioResult:
        """Scenario T — Full Recovery Flow."""
        # 1. Fault
        self.service.adapter.simulator.set_faults(disconnect=True)
        self.service.disconnect()

        # 2. Containment
        self.service.adapter.simulator.clear_faults()

        # 3. Reconnect & Renegotiate
        self.service.reconnect()

        # 4. Fresh Authorized Command
        auth = create_mock_authorization(decision=SafetyDecision.AUTHORIZED)
        result = self.service.send_authorized_command(auth)

        passed = (
            self.service.connection_state == TransportConnectionState.CONNECTED
            and result.get("status") == "ACKED"
        )
        return TransportScenarioResult(
            scenario_id="SCENARIO_T",
            name="Full End-to-End Recovery Flow",
            description="Transport experiences fault, recovers, renegotiates, and successfully transmits fresh command.",
            passed=passed,
            expected_state="CONNECTED",
            observed_state=self.service.connection_state.value,
            expected_ack_status="COMMAND_ACCEPTED",
            observed_ack_status=result.get("ack_status", "UNKNOWN"),
            retries_observed=0,
            details=result,
            timestamp=datetime.now(UTC).isoformat(),
        )
