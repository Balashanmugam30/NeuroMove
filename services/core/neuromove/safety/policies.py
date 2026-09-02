"""Versioned policy definitions and checksum verification for Safety Arbitration."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class SafetyPolicy(BaseModel):
    """Versioned parameter specification for safety arbitration rules and state machine."""

    policy_id: str = "pol_safety_v1"
    version: str = "1.0.0"
    allowlisted_intents: list[str] = Field(
        default_factory=lambda: ["LEFT", "RIGHT", "FORWARD", "BACKWARD"]
    )
    blocked_intents: list[str] = Field(
        default_factory=lambda: ["REST", "STOP", "NONE", "UNCERTAIN"]
    )
    max_intent_age_ms: float = 500.0
    max_evaluation_age_ms: float = 300.0
    max_context_age_ms: float = 1000.0
    max_authorized_duration_ms: float = 2000.0
    maximum_command_rate: int = 5
    rate_window_ms: float = 1000.0
    minimum_command_gap_ms: float = 100.0
    critical_health_requirements: list[str] = Field(
        default_factory=lambda: [
            "backend",
            "database",
            "event_dispatcher",
            "model_service",
            "intent_service",
        ]
    )
    operator_hold_enabled: bool = True
    emergency_stop_enabled: bool = True
    lockout_threshold: int = 3
    lockout_policy: str = "REQUIRE_MANUAL_RESET"
    reset_requirements: list[str] = Field(
        default_factory=lambda: [
            "HEALTH_OK",
            "NO_E_STOP",
            "NO_LOCKOUT",
            "VALID_CONTEXT",
        ]
    )
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    checksum: str = ""

    def calculate_checksum(self) -> str:
        """Calculate deterministic SHA-256 checksum over policy parameters."""
        data: dict[str, Any] = {
            "version": self.version,
            "allowlisted_intents": sorted(self.allowlisted_intents),
            "blocked_intents": sorted(self.blocked_intents),
            "max_intent_age_ms": self.max_intent_age_ms,
            "max_evaluation_age_ms": self.max_evaluation_age_ms,
            "max_context_age_ms": self.max_context_age_ms,
            "max_authorized_duration_ms": self.max_authorized_duration_ms,
            "maximum_command_rate": self.maximum_command_rate,
            "rate_window_ms": self.rate_window_ms,
            "minimum_command_gap_ms": self.minimum_command_gap_ms,
            "critical_health_requirements": sorted(self.critical_health_requirements),
            "operator_hold_enabled": self.operator_hold_enabled,
            "emergency_stop_enabled": self.emergency_stop_enabled,
            "lockout_threshold": self.lockout_threshold,
            "lockout_policy": self.lockout_policy,
            "reset_requirements": sorted(self.reset_requirements),
        }
        serialized = json.dumps(data, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


def create_default_safety_policy(version: str = "1.0.0") -> SafetyPolicy:
    """Instantiate standard canonical safety policy with computed checksum."""
    policy = SafetyPolicy(
        policy_id=f"pol_safety_v{version.replace('.', '_')}",
        version=version,
        created_at=datetime.now(UTC).isoformat(),
    )
    policy.checksum = policy.calculate_checksum()
    return policy
