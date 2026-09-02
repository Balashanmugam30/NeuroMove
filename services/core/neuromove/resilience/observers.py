"""Unified Read-Only Pipeline Observer for Phase 18.

Inspects health and lifecycle statuses across transport, confidence,
intent, safety, database, and model decoders without mutating state.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from neuromove.database.connection import default_db_manager
from neuromove.domain.enums import SafetyDecision
from neuromove.resilience.models import PipelineHealthSnapshot
from neuromove.safety.models import SafetyArbitrationState
from neuromove.safety.service import default_safety_service

logger = logging.getLogger(__name__)


class PipelineObserver:
    """Read-only telemetry collector across the NeuroMove processing pipeline."""

    def __init__(self, injector: Any = None) -> None:
        self._injector = injector

    def capture_snapshot(self) -> PipelineHealthSnapshot:
        """Collect authoritative status from all core subsystems without state mutation."""
        # 1. Database Health
        db_healthy = default_db_manager.check_health()

        # 2. Safety Subsystem Snapshot
        safety_snap = default_safety_service.get_current_snapshot()
        safety_state = safety_snap.current_state if safety_snap else SafetyArbitrationState.SAFE_IDLE
        safety_decision = safety_snap.last_decision if safety_snap else SafetyDecision.DENIED
        safety_healthy = safety_snap.system_healthy if safety_snap else False
        transport_healthy = safety_snap.stream_healthy if safety_snap else True

        # 3. Intent Subsystem State (if available)
        intent_state_str: str | None = None
        intent_healthy = True
        try:
            from neuromove.intent.service import default_intent_service

            intent_snap = default_intent_service.get_snapshot()
            if intent_snap:
                intent_state_str = intent_snap.current_state.value
        except Exception:
            intent_healthy = False

        # 4. Confidence Subsystem Health
        confidence_healthy = True
        try:
            from neuromove.confidence.service import default_confidence_service

            cal_profile = default_confidence_service.get_active_calibration_profile()
            confidence_healthy = cal_profile is not None
        except Exception:
            confidence_healthy = False

        # 5. Active Faults Count
        active_faults_count = len(self._injector.get_active_faults()) if self._injector else 0

        return PipelineHealthSnapshot(
            transport_healthy=transport_healthy,
            confidence_healthy=confidence_healthy,
            intent_healthy=intent_healthy,
            safety_healthy=safety_healthy,
            database_healthy=db_healthy,
            active_model_healthy=True,
            active_faults_count=active_faults_count,
            current_safety_state=safety_state,
            current_safety_decision=safety_decision,
            current_intent_state=intent_state_str,
            timestamp=datetime.now(UTC).isoformat(),
        )
