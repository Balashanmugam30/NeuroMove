"""Safety context definition and live/simulated context provider."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class SafetyContext(BaseModel):
    """Snapshot of environment, system health, and operator inputs for arbitration."""

    system_health: dict[str, str] = Field(
        default_factory=lambda: {
            "backend": "healthy",
            "database": "healthy",
            "event_dispatcher": "healthy",
            "model_service": "healthy",
            "intent_service": "healthy",
        }
    )
    stream_health: dict[str, Any] = Field(
        default_factory=lambda: {
            "stream_connected": True,
            "last_event_age_ms": 10.0,
            "latency_ms": 15.0,
            "dropout_detected": False,
        }
    )
    sensor_health: dict[str, Any] = Field(
        default_factory=lambda: {
            "signal_quality_score": 0.92,
            "electrodes_valid": True,
        }
    )
    intent_freshness: dict[str, Any] = Field(
        default_factory=lambda: {
            "age_ms": 50.0,
            "is_stale": False,
        }
    )
    model_health: dict[str, Any] = Field(
        default_factory=lambda: {
            "is_active": True,
            "is_rolled_back": False,
            "model_version_id": "model_v1",
        }
    )
    session_validity: dict[str, Any] = Field(
        default_factory=lambda: {
            "active_subject_id": "sub-default",
            "active_session_id": "sess-default",
        }
    )
    operator_state: dict[str, Any] = Field(
        default_factory=lambda: {
            "operator_hold": False,
            "operator_id": None,
            "hold_reason": None,
            "hold_timestamp": None,
        }
    )
    environment_state: dict[str, Any] = Field(default_factory=dict)
    execution_rate: dict[str, Any] = Field(
        default_factory=lambda: {
            "recent_authorizations_timestamps": [],
            "rate_window_ms": 1000.0,
            "last_authorization_time": None,
        }
    )
    current_action_state: dict[str, Any] = Field(
        default_factory=lambda: {
            "active_authorized_since": None,
        }
    )
    emergency_stop_state: dict[str, Any] = Field(
        default_factory=lambda: {
            "is_active": False,
            "asserted_by": None,
            "reason": None,
            "asserted_at": None,
        }
    )
    lockout_state: dict[str, Any] = Field(
        default_factory=lambda: {
            "is_locked_out": False,
            "failure_count": 0,
            "reason": None,
            "locked_out_at": None,
        }
    )


class SafetyContextProvider:
    """Provides authoritative or simulated safety context with test injection points."""

    def __init__(self) -> None:
        self._current_context = SafetyContext()

    def get_context(
        self,
        intent_snapshot: dict[str, Any] | None = None,
        overrides: dict[str, Any] | None = None,
    ) -> SafetyContext:
        """Construct full safety context incorporating current state, intent metadata, and overrides."""
        ctx_data = self._current_context.model_dump()

        if intent_snapshot:
            # Synchronize session and model references from intent if not explicitly overridden
            if not overrides or "session_validity" not in overrides:
                ctx_data["session_validity"] = {
                    "active_subject_id": intent_snapshot.get("subject_id") or "sub-default",
                    "active_session_id": intent_snapshot.get("session_id") or "sess-default",
                }
            if not overrides or "model_health" not in overrides:
                ctx_data["model_health"] = {
                    "is_active": True,
                    "is_rolled_back": False,
                    "model_version_id": intent_snapshot.get("model_version_id") or "model_v1",
                }

        if overrides:
            for k, v in overrides.items():
                if isinstance(v, dict) and k in ctx_data and isinstance(ctx_data[k], dict):
                    ctx_data[k].update(v)
                else:
                    ctx_data[k] = v

        return SafetyContext(**ctx_data)

    def set_operator_hold(
        self, hold: bool, operator_id: str | None = None, reason: str | None = None
    ) -> None:
        self._current_context.operator_state["operator_hold"] = hold
        self._current_context.operator_state["operator_id"] = operator_id
        self._current_context.operator_state["hold_reason"] = reason
        self._current_context.operator_state["hold_timestamp"] = (
            datetime.now(UTC).isoformat() if hold else None
        )

    def set_emergency_stop(
        self, is_active: bool, asserted_by: str | None = None, reason: str | None = None
    ) -> None:
        self._current_context.emergency_stop_state["is_active"] = is_active
        self._current_context.emergency_stop_state["asserted_by"] = asserted_by
        self._current_context.emergency_stop_state["reason"] = reason
        self._current_context.emergency_stop_state["asserted_at"] = (
            datetime.now(UTC).isoformat() if is_active else None
        )

    def set_lockout(
        self, is_locked_out: bool, reason: str | None = None, failure_count: int | None = None
    ) -> None:
        self._current_context.lockout_state["is_locked_out"] = is_locked_out
        self._current_context.lockout_state["reason"] = reason
        if failure_count is not None:
            self._current_context.lockout_state["failure_count"] = failure_count
        self._current_context.lockout_state["locked_out_at"] = (
            datetime.now(UTC).isoformat() if is_locked_out else None
        )

    def record_authorization(self, timestamp: float) -> None:
        timestamps: list[float] = self._current_context.execution_rate.get(
            "recent_authorizations_timestamps", []
        )
        timestamps.append(timestamp)
        # Keep recent within 10s
        cutoff = timestamp - 10.0
        self._current_context.execution_rate["recent_authorizations_timestamps"] = [
            t for t in timestamps if t >= cutoff
        ]
        self._current_context.execution_rate["last_authorization_time"] = datetime.fromtimestamp(
            timestamp, tz=UTC
        ).isoformat()

    def reset_state(self) -> None:
        """Reset internal context to safe defaults."""
        self._current_context = SafetyContext()
