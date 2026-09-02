"""NeuroMove — Phase 22 Latency & Signal Quality Analytics Engine."""

from __future__ import annotations

import logging

import numpy as np

from neuromove.research_analytics.models import (
    LatencyAnalytics,
    LatencyPercentiles,
    PipelineStage,
    SignalQualityAnalytics,
)

logger = logging.getLogger(__name__)


class LatencyAnalyticsEngine:
    """Aggregates and computes latency distribution metrics ($p_{50}, p_{90}, p_{95}, p_{99}$) across pipeline stages."""

    @staticmethod
    def compute_percentiles(latencies_ms: list[float]) -> LatencyPercentiles:
        """Compute summary percentiles for a collection of latency observations."""
        # Filter out negative or malformed latency entries
        valid = [val for val in latencies_ms if val >= 0.0]
        if not valid:
            return LatencyPercentiles()

        arr = np.array(valid, dtype=np.float64)
        return LatencyPercentiles(
            min_ms=round(float(np.min(arr)), 2),
            max_ms=round(float(np.max(arr)), 2),
            mean_ms=round(float(np.mean(arr)), 2),
            median_ms=round(float(np.median(arr)), 2),
            p50_ms=round(float(np.percentile(arr, 50)), 2),
            p90_ms=round(float(np.percentile(arr, 90)), 2),
            p95_ms=round(float(np.percentile(arr, 95)), 2),
            p99_ms=round(float(np.percentile(arr, 99)), 2),
            sample_count=len(valid),
        )

    @classmethod
    def aggregate_stage_latencies(
        cls,
        stage_observations: dict[PipelineStage | str, list[float]],
    ) -> LatencyAnalytics:
        """Aggregate per-stage latency samples and compute total pipeline percentiles."""
        per_stage: dict[str, LatencyPercentiles] = {}
        all_samples_sum: list[float] = []

        for stage, samples in stage_observations.items():
            stage_key = stage.value if isinstance(stage, PipelineStage) else str(stage)
            per_stage[stage_key] = cls.compute_percentiles(samples)

        # Compute sum of stage means for total pipeline summary
        stage_means = [p.mean_ms for p in per_stage.values() if p.sample_count > 0]
        total_p = LatencyPercentiles(
            min_ms=round(sum(p.min_ms for p in per_stage.values()), 2),
            max_ms=round(sum(p.max_ms for p in per_stage.values()), 2),
            mean_ms=round(sum(stage_means), 2),
            median_ms=round(sum(p.median_ms for p in per_stage.values()), 2),
            p50_ms=round(sum(p.p50_ms for p in per_stage.values()), 2),
            p90_ms=round(sum(p.p90_ms for p in per_stage.values()), 2),
            p95_ms=round(sum(p.p95_ms for p in per_stage.values()), 2),
            p99_ms=round(sum(p.p99_ms for p in per_stage.values()), 2),
            sample_count=max((p.sample_count for p in per_stage.values()), default=0),
        )

        return LatencyAnalytics(per_stage=per_stage, total_pipeline=total_p)


class SignalQualityAnalyticsEngine:
    """Aggregates biopotential signal quality telemetry across replay experiments."""

    @staticmethod
    def aggregate_qc_metrics(
        channel_health_snapshots: list[dict],
        flatline_count: int = 0,
        saturation_count: int = 0,
        dropout_count: int = 0,
        discontinuity_count: int = 0,
        packet_loss_pct: float = 0.0,
        buffer_overflow_count: int = 0,
    ) -> SignalQualityAnalytics:
        """Compute aggregated signal health proportions and per-channel signal-to-noise ratios."""
        if not channel_health_snapshots:
            return SignalQualityAnalytics()

        total_snaps = len(channel_health_snapshots)
        healthy_snaps = sum(1 for s in channel_health_snapshots if s.get("is_healthy", True))
        prop_healthy = round(healthy_snaps / total_snaps, 4) if total_snaps > 0 else 1.0

        # Channel SNR dictionary
        snr_dict: dict[str, float] = {}
        for s in channel_health_snapshots:
            ch = s.get("channel_name", "unknown")
            var = s.get("variance", 100.0)
            # Estimate SNR (dB) = 10 * log10(variance / noise_floor)
            snr_db = round(10.0 * np.log10(max(1.0, var / 5.0)), 2)
            snr_dict[ch] = snr_db

        return SignalQualityAnalytics(
            healthy_channel_proportion=prop_healthy,
            flatline_events=flatline_count,
            saturation_events=saturation_count,
            dropout_events=dropout_count,
            packet_loss_pct=packet_loss_pct,
            buffer_overflow_events=buffer_overflow_count,
            timestamp_discontinuities=discontinuity_count,
            per_channel_snr_db=snr_dict,
            session_quality_trend=[],
        )
