"""Deterministic Canonical Intent State Machine (Phase 16).

Authoritatively validates and computes state transitions based on explicit matrix.
"""

from __future__ import annotations

import logging
from typing import NamedTuple

from neuromove.intent.models import (
    TERMINAL_STATES,
    IntentLifecycleState,
    IntentPolicy,
    IntentTransitionReason,
    IntentTransitionTrigger,
)

logger = logging.getLogger(__name__)


class TransitionRule(NamedTuple):
    current_state: IntentLifecycleState
    trigger: IntentTransitionTrigger
    next_state: IntentLifecycleState
    default_reason: IntentTransitionReason


# Explicit Transition Matrix
LEGAL_TRANSITIONS: dict[
    tuple[IntentLifecycleState, IntentTransitionTrigger],
    tuple[IntentLifecycleState, IntentTransitionReason],
] = {
    # NO_INTENT
    (IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.HANDOFF_CANDIDATE): (
        IntentLifecycleState.CANDIDATE,
        IntentTransitionReason.CANDIDATE_CREATED,
    ),
    (IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.HANDOFF_CONFIRMED): (
        IntentLifecycleState.CONFIRMED,
        IntentTransitionReason.TEMPORAL_CONFIRMATION_ACCEPTED,
    ),
    (IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.CONTEXT_RESET): (
        IntentLifecycleState.NO_INTENT,
        IntentTransitionReason.MANUAL_RESET,
    ),
    # CANDIDATE
    (IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.HANDOFF_CONFIRMED): (
        IntentLifecycleState.CONFIRMED,
        IntentTransitionReason.TEMPORAL_CONFIRMATION_ACCEPTED,
    ),
    (IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.TIMEOUT): (
        IntentLifecycleState.EXPIRED,
        IntentTransitionReason.CANDIDATE_TIMEOUT,
    ),
    (IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.EXPLICIT_CANCEL): (
        IntentLifecycleState.CANCELLED,
        IntentTransitionReason.EXPLICIT_CANCEL,
    ),
    (IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.INTERRUPTION): (
        IntentLifecycleState.INTERRUPTED,
        IntentTransitionReason.INTERRUPTION,
    ),
    (IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.CONTEXT_RESET): (
        IntentLifecycleState.NO_INTENT,
        IntentTransitionReason.MANUAL_RESET,
    ),
    # CONFIRMED
    (IntentLifecycleState.CONFIRMED, IntentTransitionTrigger.ACCEPT_ACTIVE): (
        IntentLifecycleState.ACTIVE,
        IntentTransitionReason.TEMPORAL_CONFIRMATION_ACCEPTED,
    ),
    (IntentLifecycleState.CONFIRMED, IntentTransitionTrigger.TIMEOUT): (
        IntentLifecycleState.EXPIRED,
        IntentTransitionReason.CONFIRMATION_TIMEOUT,
    ),
    (IntentLifecycleState.CONFIRMED, IntentTransitionTrigger.EXPLICIT_CANCEL): (
        IntentLifecycleState.CANCELLED,
        IntentTransitionReason.EXPLICIT_CANCEL,
    ),
    (IntentLifecycleState.CONFIRMED, IntentTransitionTrigger.INTERRUPTION): (
        IntentLifecycleState.INTERRUPTED,
        IntentTransitionReason.INTERRUPTION,
    ),
    (IntentLifecycleState.CONFIRMED, IntentTransitionTrigger.CONTEXT_RESET): (
        IntentLifecycleState.NO_INTENT,
        IntentTransitionReason.MANUAL_RESET,
    ),
    # ACTIVE
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.EXPLICIT_COMPLETE): (
        IntentLifecycleState.COMPLETED,
        IntentTransitionReason.EXPLICIT_COMPLETE,
    ),
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.EXPLICIT_CANCEL): (
        IntentLifecycleState.CANCELLED,
        IntentTransitionReason.EXPLICIT_CANCEL,
    ),
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.TIMEOUT): (
        IntentLifecycleState.EXPIRED,
        IntentTransitionReason.ACTIVE_TIMEOUT,
    ),
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.INTERRUPTION): (
        IntentLifecycleState.INTERRUPTED,
        IntentTransitionReason.INTERRUPTION,
    ),
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.REPLACEMENT_REQUEST): (
        IntentLifecycleState.REPLACEMENT_PENDING,
        IntentTransitionReason.REPLACEMENT_REQUESTED,
    ),
    (IntentLifecycleState.ACTIVE, IntentTransitionTrigger.CONTEXT_RESET): (
        IntentLifecycleState.NO_INTENT,
        IntentTransitionReason.MANUAL_RESET,
    ),
    # REPLACEMENT_PENDING
    (IntentLifecycleState.REPLACEMENT_PENDING, IntentTransitionTrigger.REPLACEMENT_RESOLVE): (
        IntentLifecycleState.ACTIVE,
        IntentTransitionReason.REPLACEMENT_ACCEPTED,
    ),
    (IntentLifecycleState.REPLACEMENT_PENDING, IntentTransitionTrigger.EXPLICIT_CANCEL): (
        IntentLifecycleState.CANCELLED,
        IntentTransitionReason.REPLACEMENT_REJECTED,
    ),
    (IntentLifecycleState.REPLACEMENT_PENDING, IntentTransitionTrigger.INTERRUPTION): (
        IntentLifecycleState.INTERRUPTED,
        IntentTransitionReason.INTERRUPTION,
    ),
    (IntentLifecycleState.REPLACEMENT_PENDING, IntentTransitionTrigger.CONTEXT_RESET): (
        IntentLifecycleState.NO_INTENT,
        IntentTransitionReason.MANUAL_RESET,
    ),
}


class IntentStateMachine:
    """Deterministic finite state machine engine."""

    def __init__(self, policy: IntentPolicy | None = None) -> None:
        self.policy = policy or IntentPolicy()

    def is_terminal(self, state: IntentLifecycleState) -> bool:
        """Check if state is terminal (cannot mutate)."""
        return state in TERMINAL_STATES

    def can_transition(
        self,
        current_state: IntentLifecycleState,
        trigger: IntentTransitionTrigger,
    ) -> bool:
        """Determine if a transition is legal from the current state."""
        if self.is_terminal(current_state):
            return False
        return (current_state, trigger) in LEGAL_TRANSITIONS

    def validate_transition(
        self,
        current_state: IntentLifecycleState,
        trigger: IntentTransitionTrigger,
    ) -> tuple[IntentLifecycleState, IntentTransitionReason]:
        """Validate transition and return (next_state, default_reason).

        Raises ValueError if transition is illegal or terminal mutation attempted.
        """
        if self.is_terminal(current_state):
            raise ValueError(
                f"Terminal state mutation blocked: state '{current_state}' is terminal and cannot transition."
            )

        key = (current_state, trigger)
        if key not in LEGAL_TRANSITIONS:
            raise ValueError(
                f"Illegal transition: state '{current_state}' cannot accept trigger '{trigger}'."
            )

        return LEGAL_TRANSITIONS[key]

    def compute_deadline(
        self,
        state: IntentLifecycleState,
        now_ts: float,
        policy: IntentPolicy | None = None,
    ) -> float | None:
        """Compute state expiration deadline timestamp based on policy."""
        p = policy or self.policy
        if state == IntentLifecycleState.CANDIDATE:
            return now_ts + (p.candidate_timeout_ms / 1000.0)
        elif state == IntentLifecycleState.CONFIRMED:
            return now_ts + (p.confirmation_acceptance_window_ms / 1000.0)
        elif state == IntentLifecycleState.ACTIVE:
            return now_ts + (p.active_intent_timeout_ms / 1000.0)
        return None
