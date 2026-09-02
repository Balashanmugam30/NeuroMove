"""NeuroMove — Phase 21 Simulated EEG Acquisition Adapter."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import numpy as np

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.models import (
    EegAcquisitionConfig,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegDeviceDescriptor,
    EegSamplePacket,
)

logger = logging.getLogger(__name__)

DEFAULT_SIM_CHANNELS = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]


class SimulatedEegAcquisitionAdapter(EegAcquisitionAdapter):
    """Deterministic synthetic Motor-Imagery EEG generator adapter.

    Generates multi-channel sensorimotor rhythm signals (mu/beta ERD/ERS) with
    controllable noise, intent classes, artifacts, and fault injection.
    """

    def __init__(
        self,
        device_id: str = "sim_bioamp_01",
        name: str = "NeuroMove Synthetic BioAmp Simulator",
        seed: int = 42,
    ):
        self.device_id = device_id
        self.name = name
        self.seed = seed
        self._rng = np.random.default_rng(seed)

        self._state = EegAcquisitionState.DISCONNECTED
        self._config: EegAcquisitionConfig | None = None
        self._sequence_number = 0
        self._sample_index = 0
        self._current_intent = "MOVE_FORWARD"

        # Active fault overrides
        self._fault_flatline_channel: str | None = None
        self._fault_saturation_channel: str | None = None
        self._fault_nan_channel: str | None = None
        self._fault_drop_next_packet = False
        self._fault_timestamp_backwards = False

    def discover(self) -> list[EegDeviceDescriptor]:
        return [self.get_device_descriptor()]

    def get_device_descriptor(self) -> EegDeviceDescriptor:
        return EegDeviceDescriptor(
            device_id=self.device_id,
            name=self.name,
            source_type=EegAcquisitionSource.SIMULATOR,
            vendor="NeuroMove Synthetic",
            model="BioAmp-Sim-v1",
            firmware_version="sim-0.1.0",
            protocol="1.0",
            channel_count=len(DEFAULT_SIM_CHANNELS),
            supported_sampling_rates=[125, 250, 500, 1000],
            default_sampling_rate=250,
            adc_resolution_bits=24,
            is_available=True,
            is_connected=self._state
            in (
                EegAcquisitionState.CONNECTING,
                EegAcquisitionState.STREAMING,
                EegAcquisitionState.PAUSED,
            ),
            connection_path="in_memory://synthetic_bioamp",
        )

    def connect(self, device_id: str | None = None) -> bool:
        if device_id and device_id != self.device_id:
            logger.warning("Simulated adapter requested with mismatched device_id %s", device_id)
            return False
        self._state = EegAcquisitionState.CONNECTING
        logger.info("Simulated EEG adapter connected: %s", self.device_id)
        return True

    def configure(self, config: EegAcquisitionConfig) -> bool:
        self._config = config
        if config.seed is not None:
            self.seed = config.seed
            self._rng = np.random.default_rng(config.seed)
        self._state = EegAcquisitionState.CONFIGURING
        logger.info(
            "Simulated EEG configured: fs=%d Hz, %d channels",
            config.sampling_rate,
            len(config.channels),
        )
        return True

    def start_stream(self) -> bool:
        self._state = EegAcquisitionState.STREAMING
        logger.info("Simulated EEG stream started")
        return True

    def pause(self) -> bool:
        self._state = EegAcquisitionState.PAUSED
        return True

    def resume(self) -> bool:
        self._state = EegAcquisitionState.STREAMING
        return True

    def stop_stream(self) -> bool:
        self._state = EegAcquisitionState.STOPPING
        self._state = EegAcquisitionState.DISCONNECTED
        logger.info("Simulated EEG stream stopped")
        return True

    def disconnect(self) -> bool:
        self._state = EegAcquisitionState.DISCONNECTED
        self._sequence_number = 0
        self._sample_index = 0
        return True

    def get_status(self) -> EegAcquisitionState:
        return self._state

    def set_target_intent(self, intent_class: str) -> None:
        """Dynamically set synthetic intent condition to modulate ERD/ERS."""
        self._current_intent = intent_class

    def inject_fault(self, fault_type: str, params: dict[str, Any] | None = None) -> bool:
        params = params or {}
        if fault_type == "FLATLINE_CHANNEL":
            self._fault_flatline_channel = params.get("channel", "C3")
        elif fault_type == "SATURATION_CHANNEL":
            self._fault_saturation_channel = params.get("channel", "Cz")
        elif fault_type == "NAN_VALUE":
            self._fault_nan_channel = params.get("channel", "C4")
        elif fault_type == "DROP_PACKET":
            self._fault_drop_next_packet = True
        elif fault_type == "TIMESTAMP_JUMP":
            self._fault_timestamp_backwards = True
        elif fault_type == "CLEAR":
            self._fault_flatline_channel = None
            self._fault_saturation_channel = None
            self._fault_nan_channel = None
            self._fault_drop_next_packet = False
            self._fault_timestamp_backwards = False
        return True

    def read_chunk(self) -> EegSamplePacket | None:
        if self._state != EegAcquisitionState.STREAMING:
            return None

        if self._fault_drop_next_packet:
            self._fault_drop_next_packet = False
            logger.info("Simulated fault: dropped chunk")
            return None

        fs = self._config.sampling_rate if self._config else 250
        chunk_samples = self._config.chunk_size_samples if self._config else 25
        channels = (
            [ch.name for ch in self._config.channels] if self._config else DEFAULT_SIM_CHANNELS
        )
        n_channels = len(channels)

        t = (np.arange(chunk_samples) + self._sample_index) / fs

        # Generate base synthetic EEG signals (Alpha ~10Hz, Beta ~20Hz, Pink noise)
        data = np.zeros((n_channels, chunk_samples), dtype=np.float64)

        for i, ch in enumerate(channels):
            # Baseline background noise (~15 uV amplitude)
            noise = self._rng.normal(0, 15.0, chunk_samples)
            alpha_wave = 20.0 * np.sin(2 * np.pi * 10.0 * t + (i * 0.4))
            beta_wave = 10.0 * np.sin(2 * np.pi * 20.0 * t + (i * 0.6))

            # Motor imagery ERD modulation
            # Left Hand Imagery -> C4 ERD (alpha/beta attenuation)
            # Right Hand Imagery -> C3 ERD (alpha/beta attenuation)
            # Forward -> Bilateral ERD on C3 & C4
            erd_factor = 1.0
            if self._current_intent == "TURN_LEFT" and ch in ("C4", "CP2"):
                erd_factor = 0.3
            elif self._current_intent == "TURN_RIGHT" and ch in ("C3", "CP1"):
                erd_factor = 0.3
            elif self._current_intent in ("MOVE_FORWARD", "FORWARD") and ch in ("C3", "C4", "Cz"):
                erd_factor = 0.4
            elif self._current_intent == "STOP":
                erd_factor = 1.4  # Beta rebound

            sig = (alpha_wave * erd_factor) + (beta_wave * erd_factor) + noise

            # Apply active simulated faults if requested
            if self._fault_flatline_channel == ch:
                sig = np.zeros(chunk_samples, dtype=np.float64)
            elif self._fault_saturation_channel == ch:
                sig = np.full(chunk_samples, 480.0, dtype=np.float64)
            elif self._fault_nan_channel == ch:
                sig = sig.copy()
                sig[0] = np.nan

            data[i, :] = sig

        now = datetime.now(UTC)
        device_ts = self._sample_index / fs
        if self._fault_timestamp_backwards:
            self._fault_timestamp_backwards = False
            device_ts -= 10.0  # Time jumps backwards

        self._sample_index += chunk_samples
        self._sequence_number += 1

        payload_bytes = data.tobytes()
        checksum = hashlib.sha256(payload_bytes).hexdigest()[:16]

        packet = EegSamplePacket(
            packet_id=f"pkt_{uuid.uuid4().hex[:10]}",
            session_id=self._config.session_id if self._config else "sim_sess_01",
            sequence_number=self._sequence_number,
            device_timestamp=str(device_ts),
            host_receive_timestamp=now.isoformat(),
            normalized_timestamp=now.isoformat(),
            sample_count=chunk_samples,
            channel_count=n_channels,
            channels=channels,
            layout="CHANNEL_MAJOR",
            data=data.tolist(),
            checksum=checksum,
            is_valid=True,
        )
        return packet
