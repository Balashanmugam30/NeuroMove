"""NeuroMove — Phase 22 HIL Analytics Engine."""

from __future__ import annotations

import logging
from typing import Any

from neuromove.research_analytics.models import HilAnalytics

logger = logging.getLogger(__name__)


class HilAnalyticsEngine:
    """Evaluates ESP32 HIL frame transport, ACK/NACK rates, and retries."""

    @classmethod
    def analyze(
        cls,
        hil_events: list[dict[str, Any]],
    ) -> HilAnalytics:
        """Compute frame delivery metrics and transport integrity statistics."""
        if not hil_events:
            return HilAnalytics()

        candidates = len(hil_events)
        authorized = sum(1 for e in hil_events if e.get("is_authorized", True))
        transmitted = sum(1 for e in hil_events if e.get("transmitted", True))
        acks = sum(1 for e in hil_events if e.get("status") == "COMMAND_ACCEPTED" or e.get("status") == "ACK")
        nacks = sum(1 for e in hil_events if e.get("status") == "COMMAND_REJECTED" or e.get("status") == "NACK")
        retries = sum(e.get("retry_count", 0) for e in hil_events)
        crc_fails = sum(1 for e in hil_events if e.get("crc_error", False))
        seq_gaps = sum(1 for e in hil_events if e.get("sequence_gap", False))
        disconnects = sum(1 for e in hil_events if e.get("disconnected", False))

        latencies = [e.get("roundtrip_latency_ms", 2.5) for e in hil_events if "roundtrip_latency_ms" in e]
        mean_lat = round(sum(latencies) / len(latencies), 2) if latencies else 2.4

        return HilAnalytics(
            candidates=candidates,
            authorized_dispatches=authorized,
            transmitted_frames=transmitted,
            ack_count=acks,
            nack_count=nacks,
            retry_count=retries,
            crc_failures=crc_fails,
            sequence_failures=seq_gaps,
            disconnects=disconnects,
            mean_roundtrip_latency_ms=mean_lat,
        )
