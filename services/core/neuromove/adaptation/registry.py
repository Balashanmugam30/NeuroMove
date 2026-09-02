"""Model Version Registry: Manages parent-linked version graph, active pointers, and rollback."""

from __future__ import annotations

from neuromove.adaptation.models import (
    AdaptationScope,
    ModelLifecycleStatus,
    ModelVersion,
    PromotionDecision,
    PromotionDecisionStatus,
    RollbackEvent,
    generate_decision_id,
    generate_rollback_id,
    generate_version_id,
)
from neuromove.experiments.models import FeatureRepresentation, ModelFamily


class ModelVersionRegistry:
    """Manages the version tree and active model pointers."""

    def __init__(self) -> None:
        # In-memory index of versions keyed by model_id
        self._versions: dict[str, ModelVersion] = {}
        # Promotion decisions keyed by decision_id
        self._decisions: dict[str, PromotionDecision] = {}
        # Rollback events keyed by rollback_id
        self._rollbacks: dict[str, RollbackEvent] = {}

    def register_version(
        self,
        model_id: str,
        scope: AdaptationScope,
        model_family: ModelFamily,
        representation: FeatureRepresentation,
        task_id: str,
        metrics: dict[str, float],
        artifact_checksum_sha256: str,
        parent_model_id: str | None = None,
        subject_id: str | None = None,
        adaptation_id: str | None = None,
        status: ModelLifecycleStatus = ModelLifecycleStatus.ACTIVE_RESEARCH,
        is_active: bool = False,
    ) -> ModelVersion:
        """Register a new model version node in the graph."""
        # Calculate version number based on parent chain
        version_number = 1
        if parent_model_id and parent_model_id in self._versions:
            version_number = self._versions[parent_model_id].version_number + 1

        version_id = generate_version_id(model_id, version_number)

        # If this is marked active, deactivate any existing active model for this scope/subject
        if is_active:
            self._deactivate_active_model(scope, subject_id)

        version = ModelVersion(
            version_id=version_id,
            model_id=model_id,
            parent_model_id=parent_model_id,
            version_number=version_number,
            scope=scope,
            subject_id=subject_id,
            status=status,
            is_active=is_active,
            adaptation_id=adaptation_id,
            model_family=model_family,
            representation=representation,
            task_id=task_id,
            metrics=metrics,
            artifact_checksum_sha256=artifact_checksum_sha256,
        )

        self._versions[model_id] = version
        return version

    def get_version(self, model_id: str) -> ModelVersion | None:
        """Retrieve model version by model ID."""
        return self._versions.get(model_id)

    def get_active_version(
        self,
        scope: AdaptationScope,
        subject_id: str | None = None,
    ) -> ModelVersion | None:
        """Retrieve the currently active model for the given scope and subject."""
        for ver in self._versions.values():
            if ver.is_active and ver.scope == scope and ver.subject_id == subject_id:
                return ver
        return None

    def list_versions(
        self,
        scope: AdaptationScope | None = None,
        subject_id: str | None = None,
    ) -> list[ModelVersion]:
        """List all model versions sorted chronologically."""
        results = list(self._versions.values())
        if scope:
            results = [v for v in results if v.scope == scope]
        if subject_id:
            results = [v for v in results if v.subject_id == subject_id]
        return sorted(results, key=lambda v: v.version_number)

    def get_version_chain(self, model_id: str) -> list[ModelVersion]:
        """Traverse backwards from model_id through parent_model_id links."""
        chain: list[ModelVersion] = []
        curr_id: str | None = model_id
        visited: set[str] = set()

        while curr_id and curr_id in self._versions and curr_id not in visited:
            visited.add(curr_id)
            node = self._versions[curr_id]
            chain.append(node)
            curr_id = node.parent_model_id

        return list(reversed(chain))

    def promote_candidate(
        self,
        candidate_model_id: str,
        adaptation_id: str,
        operator_notes: str | None = None,
    ) -> tuple[ModelVersion, PromotionDecision]:
        """Promote a validated candidate model to become the active model."""
        if candidate_model_id not in self._versions:
            raise ValueError(f"Candidate model '{candidate_model_id}' not found in registry.")

        candidate = self._versions[candidate_model_id]

        # Deactivate current active model
        incumbent = self.get_active_version(candidate.scope, candidate.subject_id)
        if incumbent:
            updated_incumbent = incumbent.model_copy(
                update={"is_active": False, "status": ModelLifecycleStatus.VALIDATED}
            )
            self._versions[incumbent.model_id] = updated_incumbent

        # Promote candidate
        promoted_candidate = candidate.model_copy(
            update={"is_active": True, "status": ModelLifecycleStatus.ACTIVE_RESEARCH}
        )
        self._versions[candidate_model_id] = promoted_candidate

        decision_id = generate_decision_id(adaptation_id, "PROMOTED")
        decision = PromotionDecision(
            decision_id=decision_id,
            adaptation_id=adaptation_id,
            base_model_id=candidate.parent_model_id or candidate.model_id,
            candidate_model_id=candidate_model_id,
            decision=PromotionDecisionStatus.PROMOTED,
            decision_rule_version="PROMOTION_RULE_V1",
            operator_action="MANUAL_APPROVAL",
            reasons=[
                "All policy criteria satisfied.",
                operator_notes or "Operator approved promotion.",
            ],
            metrics_summary=candidate.metrics,
        )
        self._decisions[decision_id] = decision

        return promoted_candidate, decision

    def reject_candidate(
        self,
        candidate_model_id: str,
        adaptation_id: str,
        rejection_reason: str,
    ) -> tuple[ModelVersion, PromotionDecision]:
        """Explicitly reject a candidate model with operator rationale."""
        if candidate_model_id not in self._versions:
            raise ValueError(f"Candidate model '{candidate_model_id}' not found in registry.")

        candidate = self._versions[candidate_model_id]
        rejected_candidate = candidate.model_copy(
            update={"is_active": False, "status": ModelLifecycleStatus.REJECTED}
        )
        self._versions[candidate_model_id] = rejected_candidate

        decision_id = generate_decision_id(adaptation_id, "REJECTED")
        decision = PromotionDecision(
            decision_id=decision_id,
            adaptation_id=adaptation_id,
            base_model_id=candidate.parent_model_id or candidate.model_id,
            candidate_model_id=candidate_model_id,
            decision=PromotionDecisionStatus.REJECTED,
            decision_rule_version="PROMOTION_RULE_V1",
            operator_action="MANUAL_REJECTION",
            reasons=[rejection_reason],
            metrics_summary=candidate.metrics,
        )
        self._decisions[decision_id] = decision

        return rejected_candidate, decision

    def rollback(
        self,
        target_model_id: str,
        reason: str,
    ) -> tuple[ModelVersion, RollbackEvent]:
        """Roll back active model pointer to a previous validated model version."""
        if target_model_id not in self._versions:
            raise ValueError(f"Target rollback model '{target_model_id}' not found in registry.")

        target = self._versions[target_model_id]
        current_active = self.get_active_version(target.scope, target.subject_id)

        if current_active and current_active.model_id == target_model_id:
            raise ValueError(f"Model '{target_model_id}' is already the active model.")

        if current_active:
            rolled_back_current = current_active.model_copy(
                update={"is_active": False, "status": ModelLifecycleStatus.ROLLED_BACK}
            )
            self._versions[current_active.model_id] = rolled_back_current

        reactivated_target = target.model_copy(
            update={"is_active": True, "status": ModelLifecycleStatus.ACTIVE_RESEARCH}
        )
        self._versions[target_model_id] = reactivated_target

        rollback_id = generate_rollback_id(
            current_active.model_id if current_active else "none",
            target_model_id,
        )
        event = RollbackEvent(
            rollback_id=rollback_id,
            from_model_id=current_active.model_id if current_active else "none",
            to_model_id=target_model_id,
            reason=reason,
            operator_action="MANUAL_ROLLBACK",
        )
        self._rollbacks[rollback_id] = event

        return reactivated_target, event

    def _deactivate_active_model(self, scope: AdaptationScope, subject_id: str | None) -> None:
        """Deactivate existing active model for the scope/subject."""
        active = self.get_active_version(scope, subject_id)
        if active:
            deactivated = active.model_copy(
                update={"is_active": False, "status": ModelLifecycleStatus.VALIDATED}
            )
            self._versions[active.model_id] = deactivated
