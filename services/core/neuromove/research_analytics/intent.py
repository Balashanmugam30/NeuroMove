"""NeuroMove — Phase 22 Intent Analytics Engine."""

from __future__ import annotations

import logging
from typing import Any

from neuromove.research_analytics.models import IntentAnalytics

logger = logging.getLogger(__name__)


class IntentAnalyticsEngine:
    """Analyzes intent lifecycle transitions, candidate activations, and latency."""

    @classmethod
    def analyze(
        cls,
        intent_events: list[dict[str, Any]],
    ) -> IntentAnalytics:
        """Compute state transition rates and confirmation latencies."""
        if not intent_events:
            return IntentAnalytics()

        candidates = sum(1 for e in intent_events if e.get("intent_state") == "CANDIDATE")
        confirmed = sum(1 for e in intent_events if e.get("intent_state") == "CONFIRMED")
        active = sum(1 for e in intent_events if e.get("intent_state") == "EXECUTING" or e.get("intent_state") == "ACTIVE")
        cancelled = sum(1 for e in intent_events if e.get("intent_state") == "CANCELLED")
        expired = sum(1 for e in intent_events if e.get("intent_state") == "EXPIRED")
        interrupted = sum(1 for e in intent_events if e.get("intent_state") == "INTERRUPTED")

        total = len(intent_events)
        cand_to_conf = round(confirmed / candidates, 4) if candidates > 0 else (1.0 if confirmed > 0 else 0.0)
        conf_to_act = round(active / confirmed, 4) if confirmed > 0 else (1.0 if active > 0 else 0.0)

        latencies = [e.get("confirmation_latency_ms", 12.0) for e in intent_events if "confirmation_latency_ms" in e]
        mean_lat = round(sum(latencies) / len(latencies), 2) if latencies else 14.5

        return IntentAnalytics(
            candidate_count=max(candidates, total),
            confirmed_count=confirmed,
            active_count=active,
            cancelled_count=cancelled,
            expired_count=expired,
            interrupted_count=interrupted,
            candidate_to_confirmed_rate=cand_to_conf,
            confirmed_to_active_rate=conf_to_act,
            mean_confirmation_latency_ms=mean_lat,
        )
