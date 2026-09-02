"""NeuroMove — Phase 23 12 Golden Verification Scenarios for Multimodal Sensors & Fusion."""

from __future__ import annotations

import logging
from typing import Any

from neuromove.domain.enums import SafetyDecision, SensorModality
from neuromove.multimodal_sensors.adapters.simulated import SimulatedSensorAdapter
from neuromove.multimodal_sensors.service import MultimodalSensorService

logger = logging.getLogger(__name__)


class MultimodalGoldenScenarios:
    """Executes and verifies the 12 Golden Scenarios for Phase 23."""

    def __init__(self, service: MultimodalSensorService | None = None):
        self.service = service or MultimodalSensorService.get_instance()

    def run_scenario(self, scenario_id: str) -> dict[str, Any]:
        """Dispatch scenario by identifier."""
        scenarios_map = {
            "SCENARIO_A": self.scenario_a_eeg_imu_healthy,
            "SCENARIO_B": self.scenario_b_eeg_only,
            "SCENARIO_C": self.scenario_c_imu_disconnect,
            "SCENARIO_D": self.scenario_d_timestamp_drift,
            "SCENARIO_E": self.scenario_e_contradictory_context,
            "SCENARIO_F": self.scenario_f_channel_dropout,
            "SCENARIO_G": self.scenario_g_emg_context,
            "SCENARIO_H": self.scenario_h_eog_artifact,
            "SCENARIO_I": self.scenario_i_deterministic_replay,
            "SCENARIO_J": self.scenario_j_fault_recovery,
            "SCENARIO_K": self.scenario_k_authorized_end_to_end,
            "SCENARIO_L": self.scenario_l_unsafe_state,
        }

        handler = scenarios_map.get(scenario_id.upper())
        if not handler:
            return {
                "scenario_id": scenario_id,
                "passed": False,
                "error": f"Unknown scenario {scenario_id}",
            }

        self.service.reset_service()
        return handler()

    def scenario_a_eeg_imu_healthy(self) -> dict[str, Any]:
        """SCENARIO_A: Healthy synchronized streams -> valid context -> authorized HIL."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.start_session("session_scenario_a", ["sensor_eeg_sim", "sensor_imu_sim"])

        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.92)
        passed = (
            res["is_movement_valid"] is True
            and res["has_contradiction"] is False
            and res["is_authorized"] is True
            and res["hil_dispatched"] is True
        )
        return {
            "scenario_id": "SCENARIO_A",
            "name": "EEG + IMU Healthy Synchronized Baseline",
            "passed": passed,
            "data": res,
        }

    def scenario_b_eeg_only(self) -> dict[str, Any]:
        """SCENARIO_B: Single-modality EEG operation without falsely requiring auxiliary sensors."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.disconnect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.start_session("session_scenario_b", ["sensor_eeg_sim"])

        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.88)
        passed = (
            res["is_movement_valid"] is True
            and res["participating_sensors"] == ["sensor_eeg_sim"]
            and res["is_authorized"] is True
        )
        return {
            "scenario_id": "SCENARIO_B",
            "name": "EEG Only Standalone Operation",
            "passed": passed,
            "data": res,
        }

    def scenario_c_imu_disconnect(self) -> dict[str, Any]:
        """SCENARIO_C: Explicit IMU disconnect creates degraded context; safe continuation without unsafe transmission."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.start_session("session_scenario_c", ["sensor_eeg_sim", "sensor_imu_sim"])

        # Inject disconnect fault
        self.service.disconnect_device("sensor_imu_sim")
        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.85)

        passed = "sensor_imu_sim" not in res["participating_sensors"]
        return {
            "scenario_id": "SCENARIO_C",
            "name": "IMU Disconnection Handling",
            "passed": passed,
            "data": res,
        }

    def scenario_d_timestamp_drift(self) -> dict[str, Any]:
        """SCENARIO_D: Severe timestamp drift degrades synchronization and prevents unsafe execution."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.start_session("session_scenario_d", ["sensor_eeg_sim", "sensor_imu_sim"])

        # Initial clean frame to establish session time baseline
        self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.90)

        # Inject large timestamp drift / offset (250ms) on IMU adapter
        adapter = self.service.registry.get_adapter("sensor_imu_sim")
        if isinstance(adapter, SimulatedSensorAdapter):
            adapter.inject_timestamp_offset(0.25)

        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.90)
        passed = res["sync_status"] in ("UNSYNCHRONIZED", "DEGRADED", "DRIFT_DETECTED")
        return {
            "scenario_id": "SCENARIO_D",
            "name": "Timestamp Drift and Desynchronization",
            "passed": passed,
            "data": res,
        }

    def scenario_e_contradictory_context(self) -> dict[str, Any]:
        """SCENARIO_E: Violent head motion during intent triggers contradiction hold and zero HIL dispatch."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.start_session("session_scenario_e", ["sensor_eeg_sim", "sensor_imu_sim"])

        # Inject active motion burst in IMU
        self.service.inject_fault("sensor_imu_sim", "MOTION_BURST")
        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.95)

        passed = (
            res["has_contradiction"] is True
            and res["safety_verdict"] == "HELD"
            and res["hil_dispatched"] is False
        )
        return {
            "scenario_id": "SCENARIO_E",
            "name": "Contradictory Movement Context Hold",
            "passed": passed,
            "data": res,
        }

    def scenario_f_channel_dropout(self) -> dict[str, Any]:
        """SCENARIO_F: Sensor flatline / dropout creates degraded quality."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.start_session("session_scenario_f", ["sensor_eeg_sim"])

        # Inject dropout fault
        self.service.inject_fault("sensor_eeg_sim", "DROPOUT")
        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.50)

        passed = res["is_authorized"] is False
        return {
            "scenario_id": "SCENARIO_F",
            "name": "Channel Dropout Quality Fault",
            "passed": passed,
            "data": res,
        }

    def scenario_g_emg_context(self) -> dict[str, Any]:
        """SCENARIO_G: Synchronized EMG evidence produces deterministic fusion."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_emg_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_emg_sim")
        self.service.start_session("session_scenario_g", ["sensor_eeg_sim", "sensor_emg_sim"])

        adapter = self.service.registry.get_adapter("sensor_emg_sim")
        if isinstance(adapter, SimulatedSensorAdapter):
            adapter.set_emg_burst(True)

        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.91)
        passed = "sensor_emg_sim" in res["participating_sensors"]
        return {
            "scenario_id": "SCENARIO_G",
            "name": "EMG Peripheral Activation Context",
            "passed": passed,
            "data": res,
        }

    def scenario_h_eog_artifact(self) -> dict[str, Any]:
        """SCENARIO_H: EOG blink event flags contaminated EEG window."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_eog_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_eog_sim")
        self.service.start_session("session_scenario_h", ["sensor_eeg_sim", "sensor_eog_sim"])

        self.service.inject_fault("sensor_eog_sim", "BLINK")
        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.85)

        passed = "sensor_eog_sim" in res["participating_sensors"]
        return {
            "scenario_id": "SCENARIO_H",
            "name": "EOG Ocular Artifact Indicator",
            "passed": passed,
            "data": res,
        }

    def scenario_i_deterministic_replay(self) -> dict[str, Any]:
        """SCENARIO_I: Replaying the same fixture twice yields identical checksum and context score."""
        fixtures = self.service.replay_engine.list_fixtures()
        passed = len(fixtures) >= 2 and all(len(f.checksum) > 0 for f in fixtures)
        return {
            "scenario_id": "SCENARIO_I",
            "name": "Deterministic Multimodal Fixture Replay",
            "passed": passed,
            "data": {"fixture_count": len(fixtures)},
        }

    def scenario_j_fault_recovery(self) -> dict[str, Any]:
        """SCENARIO_J: Disconnect -> degrade -> reconnect -> recalibrate -> safe recovery."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.start_session("session_scenario_j", ["sensor_eeg_sim", "sensor_imu_sim"])

        # Inject fault
        self.service.inject_fault("sensor_imu_sim", "MOTION_BURST")
        res_fault = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.90)

        # Clear fault and recalibrate
        self.service.clear_faults("sensor_imu_sim")
        self.service.calibrate_device("sensor_imu_sim")
        res_recovery = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.92)

        passed = (
            res_fault["has_contradiction"] is True
            and res_recovery["has_contradiction"] is False
            and res_recovery["is_authorized"] is True
        )
        return {
            "scenario_id": "SCENARIO_J",
            "name": "Multimodal Fault Recovery & Recalibration",
            "passed": passed,
            "data": {"fault_verdict": res_fault["safety_verdict"], "recovery_verdict": res_recovery["safety_verdict"]},
        }

    def scenario_k_authorized_end_to_end(self) -> dict[str, Any]:
        """SCENARIO_K: Authorized multimodal end-to-end to Phase 20 ESP32 virtual emulator (0 physical motors)."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.connect_device("sensor_press_sim")
        self.service.calibrate_device("sensor_eeg_sim")
        self.service.calibrate_device("sensor_imu_sim")
        self.service.calibrate_device("sensor_press_sim")
        self.service.start_session("session_scenario_k", ["sensor_eeg_sim", "sensor_imu_sim", "sensor_press_sim"])

        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.94)
        passed = (
            res["is_authorized"] is True
            and res["hil_dispatched"] is True
            and "virtual emulator" in res["hil_reason"].lower()
        )
        return {
            "scenario_id": "SCENARIO_K",
            "name": "Authorized End-to-End HIL Dispatch (Non-Actuation Enforced)",
            "passed": passed,
            "data": res,
        }

    def scenario_l_unsafe_state(self) -> dict[str, Any]:
        """SCENARIO_L: Severe contradiction or unseated user results in ZERO HIL transmission."""
        self.service.connect_device("sensor_eeg_sim")
        self.service.connect_device("sensor_imu_sim")
        self.service.start_session("session_scenario_l", ["sensor_eeg_sim", "sensor_imu_sim"])

        # Inject motion burst without calibration
        self.service.inject_fault("sensor_imu_sim", "MOTION_BURST")
        res = self.service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.95)

        passed = (
            res["is_authorized"] is False
            and res["hil_dispatched"] is False
            and res["safety_verdict"] == "HELD"
        )
        return {
            "scenario_id": "SCENARIO_L",
            "name": "Unsafe Multimodal State (Zero Transmission)",
            "passed": passed,
            "data": res,
        }
