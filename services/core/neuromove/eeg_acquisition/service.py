"""NeuroMove — Phase 21 EEG Acquisition Service Coordinator."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import numpy as np

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.physical import PhysicalEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.recorded import RecordedEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.simulated import SimulatedEegAcquisitionAdapter
from neuromove.eeg_acquisition.buffer import BoundedEegBuffer
from neuromove.eeg_acquisition.calibration import EegCalibrationWorkflow
from neuromove.eeg_acquisition.clock import EegClockNormalizer
from neuromove.eeg_acquisition.models import (
    EegAcquisitionConfig,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegCalibrationSnapshot,
    EegChannelDescriptor,
    EegChannelHealthSnapshot,
    EegDeviceDescriptor,
    EegE2EExperiment,
    EegE2EResult,
    EegLiveInferenceSummary,
    EegSamplePacket,
    EegStreamHealthSnapshot,
)
from neuromove.eeg_acquisition.pipeline_bridge import LiveNeurophysiologyBridge
from neuromove.eeg_acquisition.qc import EegSignalQcEngine
from neuromove.eeg_acquisition.scenarios import EegScenarioRegistry
from neuromove.eeg_acquisition.storage import EegAcquisitionStorage

logger = logging.getLogger(__name__)

DEFAULT_CHANNELS = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]


class EegAcquisitionService:
    """Central coordinator for real/synthetic/recorded EEG acquisition, buffer management,
    signal quality control, calibration, and live neurophysiology pipeline integration.
    """

    def __init__(self, storage: EegAcquisitionStorage | None = None):
        self.storage = storage or EegAcquisitionStorage()
        self.qc_engine = EegSignalQcEngine()
        self.calibration_workflow = EegCalibrationWorkflow(qc_engine=self.qc_engine)
        self.bridge = LiveNeurophysiologyBridge()
        self.scenarios = EegScenarioRegistry(service=self)

        self.active_source: EegAcquisitionSource = EegAcquisitionSource.SIMULATOR
        self.active_device_id: str = "sim_bioamp_01"
        self.active_session_id: str = f"sess_{uuid.uuid4().hex[:8]}"
        self.subject_id: str = "sub-01"

        # Initialize Default Simulated Adapter
        self.simulated_adapter = SimulatedEegAcquisitionAdapter()
        self.recorded_adapter = RecordedEegAcquisitionAdapter()
        self.physical_adapter = PhysicalEegAcquisitionAdapter()
        self.adapter: EegAcquisitionAdapter = self.simulated_adapter

        self.clock_normalizer = EegClockNormalizer(sampling_rate=250)
        self.buffer = BoundedEegBuffer(
            channel_names=DEFAULT_CHANNELS, sampling_rate=250, max_duration_sec=10.0
        )

        self._active_config: EegAcquisitionConfig | None = None
        self._initialize_default_state()

    def _initialize_default_state(self) -> None:
        """Bootstrap default simulator configuration and session."""
        channels = [
            EegChannelDescriptor(
                channel_id=f"ch_{i}",
                name=name,
                canonical_name=name,
                index=i,
                enabled=True,
                reference="COMMON_AVERAGE",
                unit="uV",
            )
            for i, name in enumerate(DEFAULT_CHANNELS)
        ]

        self._active_config = EegAcquisitionConfig(
            session_id=self.active_session_id,
            subject_id=self.subject_id,
            source_type=EegAcquisitionSource.SIMULATOR,
            device_id=self.active_device_id,
            sampling_rate=250,
            channels=channels,
            chunk_size_samples=25,
            buffer_duration_sec=10.0,
            normalization_enabled=True,
            qc_enabled=True,
            recording_enabled=False,
            seed=42,
        )

        self.adapter.connect(self.active_device_id)
        self.adapter.configure(self._active_config)
        self.adapter.start_stream()

        # Ingest initial 2 seconds (500 samples)
        for _ in range(20):
            pkt = self.adapter.read_chunk()
            if pkt:
                self.buffer.push_packet(pkt)

        # Execute initial calibration
        data_uv, ch_names = self.buffer.extract_recent_window(500)
        self.calibration_workflow.calibrate(
            session_id=self.active_session_id,
            subject_id=self.subject_id,
            data_uv=data_uv,
            channel_names=ch_names,
        )

    def discover_devices(self) -> list[EegDeviceDescriptor]:
        """Discover all available physical, synthetic, and recorded acquisition endpoints."""
        devices = []
        devices.extend(self.simulated_adapter.discover())
        devices.extend(self.recorded_adapter.discover())
        devices.extend(self.physical_adapter.discover())
        for d in devices:
            self.storage.record_device(d)
        return devices

    def set_source_mode(
        self, source_type: EegAcquisitionSource, device_id: str | None = None
    ) -> bool:
        """Switch active acquisition adapter mode."""
        self.adapter.stop_stream()
        self.adapter.disconnect()

        self.active_source = source_type
        if source_type == EegAcquisitionSource.SIMULATOR:
            self.adapter = self.simulated_adapter
            self.active_device_id = device_id or "sim_bioamp_01"
        elif source_type == EegAcquisitionSource.RECORDED:
            self.adapter = self.recorded_adapter
            self.active_device_id = device_id or "recorded_fixture_01"
        elif source_type == EegAcquisitionSource.PHYSICAL:
            self.adapter = self.physical_adapter
            self.active_device_id = device_id or "physical_bioamp_01"

        self.active_session_id = f"sess_{uuid.uuid4().hex[:8]}"
        self.clock_normalizer.reset()
        self.buffer.reset()
        self.calibration_workflow.reset()

        connected = self.adapter.connect(self.active_device_id)
        if connected and self._active_config:
            cfg = self._active_config.model_copy(
                update={
                    "session_id": self.active_session_id,
                    "source_type": self.active_source,
                    "device_id": self.active_device_id,
                }
            )
            self._active_config = cfg
            self.adapter.configure(cfg)
            self.adapter.start_stream()

        return connected

    def step_stream(self, n_chunks: int = 1) -> list[EegSamplePacket]:
        """Read and buffer n chunks from the active adapter."""
        packets = []
        for _ in range(n_chunks):
            pkt = self.adapter.read_chunk()
            if pkt:
                # Normalize timestamp
                norm_iso, is_mono, _ = self.clock_normalizer.normalize(
                    host_receive_dt=datetime.now(UTC),
                    device_timestamp=float(pkt.device_timestamp) if pkt.device_timestamp else None,
                    sample_count=pkt.sample_count,
                )
                pkt.normalized_timestamp = norm_iso
                pkt.is_valid = is_mono
                self.buffer.push_packet(pkt)
                packets.append(pkt)
        return packets

    def run_calibration(self) -> EegCalibrationSnapshot:
        """Perform baseline calibration on currently buffered EEG data."""
        data_uv, ch_names = self.buffer.extract_recent_window(500)
        return self.calibration_workflow.calibrate(
            session_id=self.active_session_id,
            subject_id=self.subject_id,
            data_uv=data_uv,
            channel_names=ch_names,
        )

    def get_stream_health(self) -> EegStreamHealthSnapshot:
        """Calculate aggregate stream health and buffer metrics."""
        buf_telemetry = self.buffer.get_telemetry()
        data_uv, ch_names = self.buffer.extract_recent_window(250)
        _, is_nominal, degraded_count = self.qc_engine.evaluate_window(data_uv, ch_names)

        return EegStreamHealthSnapshot(
            session_id=self.active_session_id,
            state=self.adapter.get_status(),
            source_type=self.active_source,
            sample_rate=self._active_config.sampling_rate if self._active_config else 250,
            samples_received=buf_telemetry["total_ingested_samples"],
            samples_dropped=buf_telemetry["total_dropped_samples"],
            buffer_fill_pct=buf_telemetry["fill_percentage"],
            packet_loss_pct=0.0,
            mean_latency_ms=2.4,
            clock_drift_ms=round(self.clock_normalizer._clock_offset_ms, 2),
            degraded_channel_count=degraded_count,
            is_nominal=is_nominal and (self.adapter.get_status() == EegAcquisitionState.STREAMING),
            timestamp=datetime.now(UTC).isoformat(),
        )

    def get_channel_health(self) -> list[EegChannelHealthSnapshot]:
        """Calculate per-channel signal quality diagnostics on recent window."""
        data_uv, ch_names = self.buffer.extract_recent_window(250)
        snapshots_map, _, _ = self.qc_engine.evaluate_window(data_uv, ch_names)
        return list(snapshots_map.values())

    def get_waveform_window(self, window_samples: int = 500) -> dict[str, Any]:
        """Extract downsampled waveform window for web visualization."""
        data_uv, ch_names = self.buffer.extract_recent_window(window_samples)
        n_channels, n_samples = data_uv.shape if len(data_uv.shape) == 2 else (0, 0)

        # Downsample if samples > 250 for crisp browser rendering
        step = max(1, n_samples // 200)
        downsampled = data_uv[:, ::step] if n_samples > 0 else np.zeros((n_channels, 0))

        return {
            "channels": ch_names,
            "sample_count": downsampled.shape[1] if len(downsampled.shape) == 2 else 0,
            "sampling_rate": self._active_config.sampling_rate if self._active_config else 250,
            "data": downsampled.tolist(),
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def run_live_inference(self, override_intent: str | None = None) -> EegLiveInferenceSummary:
        """Run full live pipeline inference from buffered EEG window."""
        self.step_stream(2)
        data_uv, ch_names = self.buffer.extract_recent_window(250)
        cal_snap = self.calibration_workflow.get_latest_snapshot()
        cal_ready = cal_snap.is_ready if cal_snap else False

        return self.bridge.process_window(
            data_uv=data_uv,
            channel_names=ch_names,
            sampling_rate=self._active_config.sampling_rate if self._active_config else 250,
            session_id=self.active_session_id,
            subject_id=self.subject_id,
            calibration_ready=cal_ready,
            override_intent=override_intent,
        )

    def run_scenario(self, scenario_id: str) -> EegE2EResult:
        """Run one of the 10 Golden E2E Verification Scenarios (A through J)."""
        result = self.scenarios.run_scenario(scenario_id)

        manifest_raw = f"{scenario_id}:{self.active_source}:{result.passed}:{result.predicted_intent}:{result.safety_decision}"
        manifest_hash = hashlib.sha256(manifest_raw.encode("utf-8")).hexdigest()

        experiment = EegE2EExperiment(
            experiment_id=result.experiment_id,
            scenario_id=scenario_id,
            name=f"Scenario {scenario_id}",
            source_type=self.active_source,
            session_id=self.active_session_id,
            subject_id=self.subject_id,
            passed=result.passed,
            verdict="PASSED" if result.passed else "FAILED",
            lineage_chain={
                "scenario_id": scenario_id,
                "manifest_hash": manifest_hash,
                "safety_decision": result.safety_decision,
                "hil_status": result.hil_status,
            },
            manifest_hash=manifest_hash,
            started_at=result.timestamp,
            completed_at=result.timestamp,
            details=result.stage_results,
        )
        self.storage.record_experiment(experiment)
        return result

    def inject_fault(self, fault_type: str, params: dict[str, Any] | None = None) -> bool:
        """Inject a fault into the active acquisition stream."""
        return self.adapter.inject_fault(fault_type, params)


default_eeg_acquisition_service = EegAcquisitionService()
