"""NeuroMove — Phase 23 Modality-Aware Multimodal Sensor Quality Control Engine."""

from __future__ import annotations

import math
from typing import Any

from neuromove.domain.enums import SensorModality, TrialQuality
from neuromove.multimodal_sensors.models import SensorChannelHealth, SensorStreamPacket


class MultimodalQcEngine:
    """Modality-aware quality control engine.

    Evaluates signal validity, missing packets, nonfinite values, saturation,
    flatline, and modality-specific physiological range bounds.
    """

    def __init__(self):
        self._last_sequences: dict[str, int] = {}
        self._packet_loss_counters: dict[str, int] = {}
        self._total_packet_counters: dict[str, int] = {}

    def reset(self) -> None:
        self._last_sequences.clear()
        self._packet_loss_counters.clear()
        self._total_packet_counters.clear()

    def evaluate_packet(self, packet: SensorStreamPacket) -> tuple[list[SensorChannelHealth], list[str]]:
        """Evaluate QC metrics for an incoming sample packet.

        Returns:
            (channel_health_list, global_quality_flags)
        """
        flags: list[str] = []
        sensor_id = packet.sensor_id
        modality = packet.modality

        # 1. Sequence gap check
        self._total_packet_counters[sensor_id] = self._total_packet_counters.get(sensor_id, 0) + 1
        if sensor_id in self._last_sequences:
            expected_seq = self._last_sequences[sensor_id] + 1
            if packet.sequence_number > expected_seq:
                gap = packet.sequence_number - expected_seq
                self._packet_loss_counters[sensor_id] = (
                    self._packet_loss_counters.get(sensor_id, 0) + gap
                )
                flags.append(f"SEQUENCE_GAP_{gap}")
        self._last_sequences[sensor_id] = packet.sequence_number

        channel_health_list: list[SensorChannelHealth] = []

        # 2. Per-channel analysis
        for ch_idx, ch_name in enumerate(packet.channel_names):
            if ch_idx >= len(packet.data):
                continue
            samples = packet.data[ch_idx]
            if not samples:
                continue

            # Nonfinite check
            has_nonfinite = any(math.isnan(v) or math.isinf(v) for v in samples)
            if has_nonfinite:
                flags.append(f"NONFINITE_CHANNEL_{ch_name}")

            clean_samples = [v for v in samples if not (math.isnan(v) or math.isinf(v))]
            if not clean_samples:
                channel_health_list.append(
                    SensorChannelHealth(
                        channel_name=ch_name,
                        modality=modality,
                        qc_status=TrialQuality.REJECTED,
                        is_usable=False,
                    )
                )
                continue

            mean_val = sum(clean_samples) / len(clean_samples)
            variance = sum((v - mean_val) ** 2 for v in clean_samples) / len(clean_samples)
            std_val = math.sqrt(variance)

            # Flatline check
            is_flatline = variance < 1e-6 and len(clean_samples) > 2
            flatline_rate = 1.0 if is_flatline else 0.0

            # Dropout check (all zeros)
            is_dropout = all(abs(v) < 1e-6 for v in clean_samples)
            dropout_rate = 1.0 if is_dropout else 0.0

            # Saturation check based on modality
            sat_threshold = self._get_saturation_threshold(modality)
            is_saturated = any(abs(v) >= sat_threshold for v in clean_samples)
            saturation_rate = 1.0 if is_saturated else 0.0

            # Modality-specific range check
            range_valid = self._check_modality_range(modality, clean_samples)

            # Usability verdict
            is_usable = not (has_nonfinite or is_flatline or is_dropout or is_saturated or not range_valid)
            qc_status = TrialQuality.VALID if is_usable else TrialQuality.REJECTED

            # Estimate SNR (dB)
            snr_db = 20.0 * math.log10(max(1.0, std_val) / max(0.1, 1.0)) if is_usable else 0.0

            channel_health_list.append(
                SensorChannelHealth(
                    channel_name=ch_name,
                    modality=modality,
                    qc_status=qc_status,
                    mean_amplitude=mean_val,
                    snr_db=snr_db,
                    flatline_rate=flatline_rate,
                    saturation_rate=saturation_rate,
                    dropout_rate=dropout_rate,
                    is_usable=is_usable,
                )
            )

        return channel_health_list, flags

    def _get_saturation_threshold(self, modality: SensorModality) -> float:
        if modality == SensorModality.EEG:
            return 500.0  # uV
        elif modality == SensorModality.IMU:
            return 100.0  # m/s^2 or deg/s
        elif modality == SensorModality.EMG:
            return 2000.0  # uV
        elif modality == SensorModality.EOG:
            return 1000.0  # uV
        elif modality == SensorModality.PPG:
            return 5000.0  # mV
        elif modality == SensorModality.PRESSURE:
            return 500.0  # kPa
        return 10000.0

    def _check_modality_range(self, modality: SensorModality, samples: list[float]) -> bool:
        if modality == SensorModality.IMU:
            # IMU samples should not exceed 200 m/s^2 or 2000 deg/s
            return all(abs(v) <= 2000.0 for v in samples)
        elif modality == SensorModality.PPG:
            # PPG should be positive
            return any(v > 0.0 for v in samples)
        elif modality == SensorModality.PRESSURE:
            # Pressure in kPa >= 0
            return all(v >= -1.0 for v in samples)
        return True

    def get_packet_loss_rate(self, sensor_id: str) -> float:
        total = self._total_packet_counters.get(sensor_id, 0)
        lost = self._packet_loss_counters.get(sensor_id, 0)
        if total + lost == 0:
            return 0.0
        return lost / (total + lost)
