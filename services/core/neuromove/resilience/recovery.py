"""Deterministic Recovery Orchestration and Checkpoint Engine for Phase 18.

Manages safe recovery checkpoints, dependency-ordered restoration,
data loss classification, and guarantees that recovery never resumes
stale execution authorizations.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import SafetyDecision
from neuromove.resilience.models import (
    DataLossStatus,
    PipelineHealthSnapshot,
    RecoveryCheckpoint,
    RecoveryStatus,
)
from neuromove.safety.models import SafetyArbitrationState

logger = logging.getLogger(__name__)


class RecoveryOrchestrator:
    """Coordinates dependency-aware recovery and checkpoint management."""

    def __init__(self) -> None:
        self._checkpoints: dict[str, RecoveryCheckpoint] = {}

    def capture_checkpoint(
        self,
        experiment_id: str,
        component: str,
        safe_state: str,
        sequence_number: int,
        snapshot_version: str,
        details: dict[str, Any] | None = None,
    ) -> RecoveryCheckpoint:
        """Capture a deterministic safe recovery checkpoint with SHA-256 checksum."""
        detail_data = details or {}
        checksum_payload = json.dumps(
            {
                "experiment_id": experiment_id,
                "component": component,
                "safe_state": safe_state,
                "sequence_number": sequence_number,
                "snapshot_version": snapshot_version,
            },
            sort_keys=True,
        )
        chk_sum = hashlib.sha256(checksum_payload.encode("utf-8")).hexdigest()[:16]

        checkpoint = RecoveryCheckpoint(
            checkpoint_id=f"chk_{uuid.uuid4().hex[:12]}",
            experiment_id=experiment_id,
            component=component,
            last_known_safe_state=safe_state,
            sequence_number=sequence_number,
            snapshot_version=snapshot_version,
            checksum=chk_sum,
            timestamp=datetime.now(UTC).isoformat(),
            details=detail_data,
        )
        self._checkpoints[checkpoint.checkpoint_id] = checkpoint
        logger.info(
            "Captured recovery checkpoint %s for component %s (state: %s)",
            checkpoint.checkpoint_id,
            component,
            safe_state,
        )
        return checkpoint

    def get_checkpoint(self, checkpoint_id: str) -> RecoveryCheckpoint | None:
        return self._checkpoints.get(checkpoint_id)

    def list_checkpoints(self, experiment_id: str | None = None) -> list[RecoveryCheckpoint]:
        if experiment_id:
            return [c for c in self._checkpoints.values() if c.experiment_id == experiment_id]
        return list(self._checkpoints.values())

    def evaluate_recovery(
        self,
        pre_fault_checkpoint: RecoveryCheckpoint | None,
        current_health: PipelineHealthSnapshot,
        data_loss: DataLossStatus = DataLossStatus.NONE,
        reboot_occurred: bool = False,
        was_emergency_stop: bool = False,
        was_lockout: bool = False,
    ) -> tuple[RecoveryStatus, DataLossStatus, str]:
        """Certify the recovery status and guarantee fail-closed semantics."""
        # Rule 1: If E-stop or lockout was active prior to recovery or reboot,
        # it MUST remain in restrictive state unless cleared through verified reset
        if was_emergency_stop:
            if current_health.current_safety_state != SafetyArbitrationState.EMERGENCY_STOP:
                return (
                    RecoveryStatus.RECOVERY_FAILED,
                    DataLossStatus.CRITICAL,
                    "Emergency stop state was illegally cleared during recovery.",
                )
            return (
                RecoveryStatus.RECOVERED_RESTRICTIVELY,
                data_loss,
                "Safely recovered into persistent EMERGENCY_STOP state.",
            )

        if was_lockout:
            if current_health.current_safety_state != SafetyArbitrationState.LOCKED_OUT:
                return (
                    RecoveryStatus.RECOVERY_FAILED,
                    DataLossStatus.CRITICAL,
                    "Lockout state was illegally cleared during recovery.",
                )
            return (
                RecoveryStatus.RECOVERED_RESTRICTIVELY,
                data_loss,
                "Safely recovered into persistent LOCKED_OUT state.",
            )

        # Rule 2: If critical data loss occurred, recovery is uncertain and cannot authorize
        if data_loss == DataLossStatus.CRITICAL:
            return (
                RecoveryStatus.RECOVERY_UNCERTAIN,
                DataLossStatus.CRITICAL,
                "Critical state unverified; fresh arbitration strictly mandatory.",
            )

        # Rule 3: Restarts must NOT auto-resume authorization
        if reboot_occurred:
            if current_health.current_safety_decision == SafetyDecision.AUTHORIZED:
                return (
                    RecoveryStatus.RECOVERY_FAILED,
                    DataLossStatus.CRITICAL,
                    "Reboot illegally resumed prior execution authorization.",
                )
            return (
                RecoveryStatus.RECOVERED_CLEANLY,
                data_loss,
                "System reboot recovered into SAFE_IDLE; fresh evaluation required.",
            )

        # Rule 4: Clean recovery if all core subsystems are healthy
        if (
            current_health.safety_healthy
            and current_health.confidence_healthy
            and current_health.intent_healthy
            and current_health.database_healthy
        ):
            if data_loss == DataLossStatus.AUDIT_ONLY:
                return (
                    RecoveryStatus.RECOVERED_WITH_DATA_LOSS,
                    data_loss,
                    "Recovered with non-critical audit log gaps.",
                )
            return (
                RecoveryStatus.RECOVERED_CLEANLY,
                data_loss,
                "All subsystems recovered cleanly to baseline operational state.",
            )

        return (
            RecoveryStatus.RECOVERED_RESTRICTIVELY,
            data_loss,
            "Recovered in restricted/degraded posture due to partial service health.",
        )
