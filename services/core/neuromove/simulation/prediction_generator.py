"""NeuroMove Synthetic Prediction Generator.

Produces coherent intent predictions and Bayesian neural confidence profiles
for downstream temporal confirmation and safety arbitration testing.
"""

from __future__ import annotations

import random
from typing import Literal

from neuromove.domain.enums import Intent
from neuromove.events.envelope import IntentConfirmedPayload, PredictionPayload

ConfidenceProfile = Literal["HIGH", "MEDIUM", "LOW", "UNSTABLE", "UNCERTAIN"]


class SyntheticPredictionGenerator:
    """Deterministic prediction generator emitting canonical PredictionPayload."""

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self.model_id: str = "simulator.synthetic-decoder"
        self.model_version: str = "1.0.0"

    def generate_prediction(
        self,
        target_intent: Intent = Intent.NONE,
        profile: ConfidenceProfile = "HIGH",
        window_id: str | None = None,
    ) -> PredictionPayload:
        """Generate statistically coherent class probabilities and neural confidence."""
        classes = [Intent.LEFT, Intent.RIGHT, Intent.FORWARD, Intent.NONE]

        if profile == "HIGH":
            primary_conf = round(self._rng.uniform(0.88, 0.96), 3)
        elif profile == "MEDIUM":
            primary_conf = round(self._rng.uniform(0.72, 0.84), 3)
        elif profile == "LOW":
            primary_conf = round(self._rng.uniform(0.50, 0.65), 3)
        elif profile == "UNSTABLE":
            primary_conf = round(self._rng.uniform(0.40, 0.90), 3)
        else:  # UNCERTAIN
            primary_conf = round(self._rng.uniform(0.30, 0.48), 3)

        if target_intent == Intent.UNCERTAIN or profile == "UNCERTAIN":
            target_intent = Intent.UNCERTAIN
            primary_conf = min(0.48, primary_conf)

        # Distribute remaining probability evenly across other classes
        remaining = max(0.0, 1.0 - primary_conf)
        other_classes = [c for c in classes if c != target_intent]
        other_shares: dict[Intent, float] = {}

        if other_classes:
            raw_weights = [self._rng.uniform(0.1, 1.0) for _ in other_classes]
            total_weight = sum(raw_weights)
            for c, w in zip(other_classes, raw_weights, strict=True):
                other_shares[c] = round(remaining * (w / total_weight), 4)

        # Ensure probabilities sum to 1.0 exactly
        class_probabilities: dict[str, float] = {}
        if target_intent != Intent.UNCERTAIN:
            class_probabilities[target_intent.value] = primary_conf
        for c, p in other_shares.items():
            class_probabilities[c.value] = p

        # Normalize to 1.0
        total_p = sum(class_probabilities.values())
        if total_p > 0:
            class_probabilities = {k: round(v / total_p, 4) for k, v in class_probabilities.items()}
            # Adjust rounding residue on target or first key
            diff = round(1.0 - sum(class_probabilities.values()), 4)
            first_k = next(iter(class_probabilities))
            class_probabilities[first_k] = round(class_probabilities[first_k] + diff, 4)

        return PredictionPayload(
            intent=target_intent,
            class_probabilities=class_probabilities,
            neural_confidence=primary_conf,
            raw_label=f"sim_{target_intent.value.lower()}",
            model_id=self.model_id,
            model_version=self.model_version,
            window_id=window_id or "win_sim_0001",
        )

    def generate_intent_confirmed(
        self,
        intent: Intent,
        confidence: float = 0.92,
        confirmation_window_ms: int = 750,
        consecutive_epochs: int = 3,
    ) -> IntentConfirmedPayload:
        """Generate canonical IntentConfirmedPayload after temporal confirmation."""
        return IntentConfirmedPayload(
            intent=intent,
            confidence=confidence,
            confirmation_window_ms=confirmation_window_ms,
            consecutive_epochs=consecutive_epochs,
            rule_id="sim.bayes_debounce_v1",
        )
