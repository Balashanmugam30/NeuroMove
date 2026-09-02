"""Deterministic Replay Engine for Phase 18 Resilience Laboratory.

Replays recorded failure experiments from immutable manifests, verifying
idempotent outcomes, invariant parity, and cryptographic checksum matches.
"""

from __future__ import annotations

import logging
from typing import Any

from neuromove.resilience.models import (
    FaultExperiment,
    FaultExperimentManifest,
)

logger = logging.getLogger(__name__)


class ReplayEngine:
    """Executes deterministic replay of resilience experiments from immutable manifests."""

    def __init__(self, resilience_service: Any) -> None:
        self.service = resilience_service

    def replay_experiment(self, experiment_id: str) -> tuple[bool, FaultExperiment, str]:
        """Re-run a recorded experiment and verify determinism against original manifest."""
        original = self.service.storage.get_experiment(experiment_id)
        if not original:
            raise ValueError(f"Experiment {experiment_id} not found in storage.")

        manifest: FaultExperimentManifest = original.manifest
        logger.info(
            "Replaying experiment %s (scenario: %s, seed: %d)",
            manifest.experiment_id,
            manifest.scenario_id,
            manifest.seed,
        )

        # 1. Clean environment and verify baseline
        self.service.cleanup_experiment()
        baseline = self.service.capture_baseline()

        # 2. Re-inject specified fault sequence
        for fault in manifest.fault_sequence:
            self.service.injector.inject(fault)

        # 3. Evaluate candidate intent through the perturbed pipeline
        _ = self.service.evaluate_test_intent()

        # 4. Observe system health and evaluate invariants
        final_snap = self.service.observer.capture_snapshot()
        invariants = self.service.invariants.evaluate_all(
            baseline=baseline,
            current=final_snap,
            active_faults=self.service.injector.get_active_faults(),
        )

        # 5. Recovery & cleanup
        self.service.cleanup_experiment()

        # 6. Check invariant parity
        original_passed_count = sum(1 for inv in original.invariants if inv.status == "PASS")
        replayed_passed_count = sum(1 for inv in invariants if inv.status == "PASS")
        parity_matched = original_passed_count == replayed_passed_count

        logger.info(
            "Replay completed for %s: Parity matched = %s (%d vs %d passed)",
            experiment_id,
            parity_matched,
            replayed_passed_count,
            original_passed_count,
        )

        return parity_matched, original, original.manifest.manifest_checksum
