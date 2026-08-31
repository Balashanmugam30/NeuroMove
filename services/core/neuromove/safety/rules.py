"""Safety arbitration rules and guardrails."""

from ..domain.enums import Intent, RiskLevel, SafetyDecision
from ..domain.models import SignalQuality


class SafetyArbitrator:
    """Evaluates candidate intents against signal quality, risk, and boundaries."""

    def __init__(
        self,
        min_confidence_threshold: float = 0.65,
        min_signal_quality_threshold: float = 0.50,
    ) -> None:
        self.min_confidence = min_confidence_threshold
        self.min_signal_quality = min_signal_quality_threshold

    def evaluate_intent(
        self,
        intent: Intent,
        confidence: float,
        signal_quality: SignalQuality,
        risk_level: RiskLevel = RiskLevel.SAFE,
    ) -> tuple[SafetyDecision, str]:
        """Arbitrate candidate intent against safety thresholds."""
        if risk_level == RiskLevel.CRITICAL:
            return SafetyDecision.STOP, "Critical environmental or hardware risk active."

        if intent == Intent.STOP:
            return SafetyDecision.STOP, "Explicit STOP intent requested."

        if intent == Intent.NONE or intent == Intent.UNCERTAIN:
            return SafetyDecision.BLOCKED, f"Intent '{intent.value}' cannot be executed."

        if signal_quality.overall_score < self.min_signal_quality:
            return (
                SafetyDecision.BLOCKED,
                f"Signal quality {signal_quality.overall_score:.2f} below threshold {self.min_signal_quality:.2f}",
            )

        if confidence < self.min_confidence:
            return (
                SafetyDecision.BLOCKED,
                f"Confidence {confidence:.2f} below minimum threshold {self.min_confidence:.2f}",
            )

        return (
            SafetyDecision.APPROVED,
            "Intent satisfies confidence, signal quality, and risk gates.",
        )
