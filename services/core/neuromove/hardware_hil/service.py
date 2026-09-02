"""Hardware-in-the-Loop coordinator service managing adapters, safety, and telemetry."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import EventType
from neuromove.events.envelope import EventEnvelope
from neuromove.hardware_hil.emulator import Esp32ProtocolEmulator
from neuromove.hardware_hil.models import (
    Esp32DeviceInfo,
    FirmwareIdentity,
    HardwareConnectionState,
    HardwareDiagnostic,
    HardwareEndpointMode,
    HardwareHealth,
    HardwareRecoveryResult,
    HardwareSession,
    HardwareStatus,
    HILExperiment,
    HILScenarioResult,
    SerialPortDescriptor,
)
from neuromove.hardware_hil.ports import discover_serial_ports, validate_port_settings
from neuromove.hardware_hil.scenarios import HILScenarioRegistry
from neuromove.hardware_hil.serial_adapter import SerialEsp32Adapter
from neuromove.hardware_hil.state_machine import HardwareConnectionStateMachine
from neuromove.hardware_hil.storage import HardwareHilStorage
from neuromove.hardware_hil.virtual_adapter import VirtualSerialAdapter
from neuromove.transport.models import TransportStream
from neuromove.transport_protocol.adapters import SimulatedEsp32Adapter, TransportAdapter
from neuromove.transport_protocol.commands import (
    create_command_envelope,
    validate_authorization,
)
from neuromove.transport_protocol.framing import pack_frame
from neuromove.transport_protocol.heartbeat import HeartbeatMonitor
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandNack,
    CommandPayload,
    CommandType,
    ExecutionAuthorization,
    HeartbeatStatus,
    TransportMetrics,
)
from neuromove.transport_protocol.reliability import RetryManager
from neuromove.transport_protocol.sequence import SequenceTracker
from neuromove.transport_protocol.simulator import Esp32Simulator

logger = logging.getLogger(__name__)


class HardwareHilService:
    """Authoritative singleton coordinating the Hardware-in-the-Loop subsystem."""

    def __init__(
        self,
        storage: HardwareHilStorage | None = None,
        scenario_registry: HILScenarioRegistry | None = None,
    ) -> None:
        self.storage = storage or HardwareHilStorage()
        self.scenario_registry = scenario_registry or HILScenarioRegistry()

        # Active operating mode & adapter
        self.active_mode = HardwareEndpointMode.SIMULATOR
        self.simulator = Esp32Simulator()
        self.emulator = Esp32ProtocolEmulator()
        self.adapter: TransportAdapter = SimulatedEsp32Adapter(simulator=self.simulator)

        # State management
        self.state_machine = HardwareConnectionStateMachine()
        self.heartbeat_monitor = HeartbeatMonitor()
        self.sequence_tracker = SequenceTracker()
        self.retry_manager = RetryManager()

        # Session & device state
        self.active_session_id: str | None = None
        self.active_port: str = "SIMULATED_ENDPOINT"
        self.device_info: Esp32DeviceInfo | None = None
        self.firmware_identity: FirmwareIdentity | None = None

        # Metrics
        self.metrics = TransportMetrics()

        # Initialize default simulator state
        self._initialize_default_state()

    def _initialize_default_state(self) -> None:
        """Bootstrap default simulator connection and record initial device identity."""
        self.active_session_id = f"sess_hw_{uuid.uuid4().hex[:8]}"
        self.device_info = Esp32DeviceInfo(
            device_id="esp32_sim_01",
            device_type="ESP32_SIMULATOR",
            device_mode=HardwareEndpointMode.SIMULATOR,
            firmware_version="esp32-neuromove-v0.1.0",
            firmware_build="bld_20260901_sim",
            protocol_version="1.0",
            boot_id=self.simulator.boot_id,
            hardware_revision="ESP32-DevKitC-v4",
            capabilities=self.simulator.capabilities,
            uptime_ms=1000,
            hashed_serial_identifier="hash_esp32_sim_01",
            last_seen=datetime.now(UTC).isoformat(),
        )
        self.firmware_identity = FirmwareIdentity(
            firmware_name="esp32-neuromove-hil",
            firmware_version="0.1.0",
            build_hash="bld_20260901_sim",
            compiled_at=datetime.now(UTC).isoformat(),
            target_mcu="ESP32-S3",
            is_hil_only=True,
        )
        self.storage.record_device(self.device_info)
        self.state_machine.transition_to(
            HardwareConnectionState.CONNECTING, "Initial bootstrap"
        )
        self.state_machine.transition_to(
            HardwareConnectionState.NEGOTIATING, "Negotiating bootstrap session"
        )
        self.adapter.negotiate("1.0", self.active_session_id)
        self.state_machine.transition_to(
            HardwareConnectionState.READY, "Handshake complete"
        )

    def get_status(self) -> HardwareStatus:
        """Return the current aggregated HardwareStatus."""
        hb_status = self.heartbeat_monitor.get_status()
        return HardwareStatus(
            connection_state=self.state_machine.current_state,
            active_mode=self.active_mode,
            device=self.device_info,
            firmware=self.firmware_identity,
            session_id=self.active_session_id,
            boot_id=self.device_info.boot_id if self.device_info else None,
            heartbeat=hb_status,
            health=self.get_health(),
            metrics=self.metrics,
            simulated_mode=(self.active_mode != HardwareEndpointMode.HIL_ESP32),
            updated_at=datetime.now(UTC).isoformat(),
        )

    def get_health(self) -> HardwareHealth:
        """Return multi-factor health telemetry."""
        is_ready = self.state_machine.current_state == HardwareConnectionState.READY
        is_connected = self.state_machine.current_state in (
            HardwareConnectionState.READY,
            HardwareConnectionState.CONNECTED,
        )
        hb_status = self.heartbeat_monitor.get_status()
        return HardwareHealth(
            link_state=self.state_machine.current_state,
            application_healthy=True,
            device_connected=is_connected,
            device_ready=is_ready,
            heartbeat_healthy=hb_status.missed_count == 0,
            command_channel_healthy=is_ready and hb_status.missed_count < 2,
            round_trip_time_ms=hb_status.round_trip_time_ms or 2.5,
            missed_heartbeats=hb_status.missed_count,
        )

    def list_ports(self) -> list[SerialPortDescriptor]:
        """Discover and return available serial ports."""
        return discover_serial_ports()

    def set_endpoint_mode(
        self,
        mode: HardwareEndpointMode,
        port: str | None = None,
        baud_rate: int = 115200,
    ) -> bool:
        """Switch operating adapter mode (SIMULATOR, VIRTUAL_SERIAL, HIL_ESP32)."""
        logger.info("Switching hardware endpoint mode to %s (port: %s)", mode, port)
        self.adapter.close()

        self.active_mode = mode
        self.state_machine.reset()
        self.state_machine.transition_to(HardwareConnectionState.CONNECTING, f"Switching mode to {mode}")

        if mode == HardwareEndpointMode.VIRTUAL_SERIAL:
            self.active_port = port or "VIRTUAL_COM_01"
            self.emulator = Esp32ProtocolEmulator(device_mode=mode)
            self.adapter = VirtualSerialAdapter(emulator=self.emulator, port_name=self.active_port)
            self.device_info = self.emulator.get_device_info()
        elif mode == HardwareEndpointMode.HIL_ESP32:
            self.active_port = port or "COM3"
            self.adapter = SerialEsp32Adapter(port=self.active_port, baud_rate=baud_rate)
            self.device_info = Esp32DeviceInfo(
                device_id=f"esp32_hw_{self.active_port}",
                device_type="ESP32_PHYSICAL_HIL",
                device_mode=mode,
                firmware_version="esp32-neuromove-hw-v0.1.0",
                firmware_build="rel-2026.09.01",
                protocol_version="1.0",
                boot_id=f"boot_hw_{uuid.uuid4().hex[:8]}",
                hardware_revision="ESP32-S3-WROOM-1",
                capabilities=self.adapter.capabilities(),
                uptime_ms=5000,
                hashed_serial_identifier=f"hash_{self.active_port}",
                last_seen=datetime.now(UTC).isoformat(),
            )
        else:
            self.active_port = "SIMULATED_ENDPOINT"
            self.simulator = Esp32Simulator()
            self.adapter = SimulatedEsp32Adapter(simulator=self.simulator)
            self.device_info = Esp32DeviceInfo(
                device_id=self.simulator.device_id,
                device_type=self.simulator.device_type,
                device_mode=mode,
                firmware_version=self.simulator.firmware_version,
                firmware_build="bld_20260901_sim",
                protocol_version=self.simulator.protocol_version,
                boot_id=self.simulator.boot_id,
                hardware_revision="ESP32-DevKitC-v4",
                capabilities=self.simulator.capabilities,
                uptime_ms=1000,
                hashed_serial_identifier=f"hash_{self.simulator.device_id}",
                last_seen=datetime.now(UTC).isoformat(),
            )

        self.active_session_id = f"sess_hw_{uuid.uuid4().hex[:8]}"
        self.state_machine.transition_to(HardwareConnectionState.NEGOTIATING, "Negotiating session")
        success, _, _ = self.adapter.negotiate("1.0", self.active_session_id)
        if success:
            self.state_machine.transition_to(HardwareConnectionState.READY, "Handshake completed")
            self.storage.record_device(self.device_info)
            session = HardwareSession(
                session_id=self.active_session_id,
                device_id=self.device_info.device_id,
                boot_id=self.device_info.boot_id,
                device_mode=self.active_mode,
                protocol_version="1.0",
                firmware_version=self.device_info.firmware_version,
                status="ACTIVE",
            )
            self.storage.record_session(session)
            return True
        else:
            self.state_machine.transition_to(HardwareConnectionState.ERROR, "Negotiation failed")
            return False

    def send_command(
        self,
        command_type: CommandType,
        intent_class: str,
        authorization: ExecutionAuthorization,
        subject_id: str = "sub-01",
    ) -> dict[str, Any]:
        """Validate upstream Phase 17 safety decision and dispatch framed command over adapter."""
        # 1. UPSTREAM PHASE 17 INVARIANT CHECK
        is_valid, reason_code, _ = validate_authorization(authorization)
        if not is_valid:
            self.metrics.commands_rejected += 1
            logger.warning(
                "Phase 17 safety gate blocked hardware transmission: %s (decision: %s)",
                reason_code,
                authorization.decision,
            )
            return {
                "status": "COMMAND_REJECTED",
                "reason": reason_code,
                "command_id": None,
                "transmission_count": 0,
                "message": "Phase 17 safety decision prohibited frame transmission.",
            }

        # 2. Check connection health
        if self.state_machine.current_state != HardwareConnectionState.READY:
            self.metrics.commands_rejected += 1
            return {
                "status": "COMMAND_REJECTED",
                "reason": f"Hardware connection not READY (current: {self.state_machine.current_state})",
                "command_id": None,
                "transmission_count": 0,
            }

        # 3. Construct Envelope & Binary Frame
        command_id = f"cmd_hw_{uuid.uuid4().hex[:8]}"
        seq_num = self.sequence_tracker.allocate_next_tx()
        envelope = create_command_envelope(
            auth=authorization,
            device_id=self.device_info.device_id if self.device_info else "esp32_sim_01",
            sequence_number=seq_num,
            command_id=command_id,
            parameters={"intent_class": intent_class, "command_type": command_type.value},
        )
        frame_bytes = pack_frame(envelope)
        self.metrics.commands_sent += 1

        # 4. Transmit Frame over active adapter
        ack_or_nack = self.adapter.send_frame(frame_bytes)

        if isinstance(ack_or_nack, CommandAck):
            self.metrics.commands_acknowledged += 1
            if ack_or_nack.status == CommandAckStatus.COMMAND_DUPLICATE:
                self.metrics.commands_duplicated += 1
            return {
                "status": ack_or_nack.status.value if hasattr(ack_or_nack.status, "value") else str(ack_or_nack.status),
                "command_id": command_id,
                "sequence_number": seq_num,
                "message_id": ack_or_nack.message_id,
                "latency_ms": 2.5,
                "transmission_count": 1,
            }
        else:
            return {
                "status": "COMMAND_NACK",
                "command_id": command_id,
                "sequence_number": seq_num,
                "error_code": getattr(ack_or_nack, "error_code", "ERROR"),
                "reason": getattr(ack_or_nack, "reason", "Unknown error"),
                "retryable": getattr(ack_or_nack, "retryable", False),
                "transmission_count": 1,
            }

    def ping_heartbeat(self) -> float:
        """Dispatch heartbeat ping across active adapter and update link health."""
        try:
            self.heartbeat_monitor.record_ping_sent()
            rtt = self.adapter.ping()
            self.heartbeat_monitor.record_pong_received()
            return rtt
        except Exception as exc:
            logger.warning("Heartbeat ping failed: %s", exc)
            new_state = self.heartbeat_monitor.record_missed_heartbeat()
            if self.heartbeat_monitor._missed_count >= 3:
                self.state_machine.transition_to(
                    HardwareConnectionState.STALE, "3 missed heartbeats"
                )
            elif self.heartbeat_monitor._missed_count >= 2:
                self.state_machine.transition_to(
                    HardwareConnectionState.DEGRADED, "2 missed heartbeats"
                )
            raise

    def reboot_device(self) -> str:
        """Trigger cold reboot on emulator/simulator and reconcile session."""
        logger.info("Executing cold reboot on active hardware endpoint")
        new_boot: str
        if isinstance(self.adapter, VirtualSerialAdapter):
            new_boot = self.emulator.reboot()
        else:
            new_boot = self.simulator.reboot()

        self.state_machine.reset()
        self.device_info.boot_id = new_boot
        self.active_session_id = f"sess_hw_{uuid.uuid4().hex[:8]}"

        # Re-negotiate
        self.state_machine.transition_to(HardwareConnectionState.CONNECTING, "Post-reboot reconnect")
        self.state_machine.transition_to(HardwareConnectionState.NEGOTIATING, "Post-reboot negotiation")
        self.adapter.negotiate("1.0", self.active_session_id)
        self.state_machine.transition_to(HardwareConnectionState.READY, "Reboot recovery complete")
        return new_boot

    def run_scenario(self, scenario_id: str) -> HILScenarioResult:
        """Execute a canonical HIL scenario (A through T) and persist the result."""
        result = self.scenario_registry.run_scenario(scenario_id)

        # Construct experiment manifest
        manifest_raw = f"{scenario_id}:{self.active_mode}:{result.passed}:{result.observed_ack_status}"
        manifest_hash = hashlib.sha256(manifest_raw.encode("utf-8")).hexdigest()

        exp = HILExperiment(
            scenario_id=scenario_id,
            name=result.name,
            device_mode=self.active_mode,
            device_id=self.device_info.device_id if self.device_info else "esp32_sim_01",
            firmware_version=self.device_info.firmware_version if self.device_info else "0.1.0",
            protocol_version="1.0",
            manifest_hash=manifest_hash,
            passed=result.passed,
            verdict="PASS" if result.passed else "FAIL",
            started_at=datetime.now(UTC).isoformat(),
            completed_at=datetime.now(UTC).isoformat(),
            details={"observed_ack_status": result.observed_ack_status, "latency_ms": result.latency_ms},
        )
        self.storage.record_experiment(exp)
        return result


# Singleton instance
default_hardware_service = HardwareHilService()
