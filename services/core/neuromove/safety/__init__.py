"""Safety state machine, rule evaluation, and arbitration framework for NeuroMove."""

from .context import SafetyContext, SafetyContextProvider
from .evaluator import SafetyRuleEngine
from .models import (
    PrecedenceRank,
    RuleSeverity,
    RuleStatus,
    SafetyArbitrationState,
    SafetyDiagnostics,
    SafetyEvaluation,
    SafetyRuleResult,
    SafetyScenarioResult,
    SafetyStateSnapshot,
    SafetyStateTransition,
)
from .policies import SafetyPolicy, create_default_safety_policy
from .rules import (
    DEFAULT_SAFETY_RULES,
    ActiveDurationRule,
    BaseSafetyRule,
    CriticalSystemHealthRule,
    EmergencyStopRule,
    EvidenceProvenanceRule,
    IntentAllowlistRule,
    IntentEligibilityRule,
    IntentFreshnessRule,
    IntentInputValidityRule,
    LockoutRule,
    ModelProvenanceRule,
    OperatorHoldRule,
    RateLimiterRule,
    SafetyArbitrator,
    StreamHealthRule,
)
from .service import SafetyService, default_safety_service
from .state_machine import (
    ALLOWED_TRANSITIONS,
    SAFETY_ARBITRATION_TRANSITIONS,
    InvalidStateTransitionError,
    SafetyArbitrationStateMachine,
    SafetyArbitrationTransitionError,
    SafetyStateMachine,
    TransitionHook,
    default_safety_state_machine,
)
from .storage import SafetyStorage

__all__ = [
    # Legacy compatibility symbols
    "ALLOWED_TRANSITIONS",
    "InvalidStateTransitionError",
    "SafetyArbitrator",
    "SafetyStateMachine",
    "TransitionHook",
    "default_safety_state_machine",
    # Phase 17 Models & Enums
    "SafetyArbitrationState",
    "RuleStatus",
    "RuleSeverity",
    "PrecedenceRank",
    "SafetyRuleResult",
    "SafetyEvaluation",
    "SafetyStateSnapshot",
    "SafetyStateTransition",
    "SafetyDiagnostics",
    "SafetyScenarioResult",
    # Phase 17 Policy
    "SafetyPolicy",
    "create_default_safety_policy",
    # Phase 17 Context
    "SafetyContext",
    "SafetyContextProvider",
    # Phase 17 Rules
    "DEFAULT_SAFETY_RULES",
    "BaseSafetyRule",
    "EmergencyStopRule",
    "LockoutRule",
    "IntentInputValidityRule",
    "CriticalSystemHealthRule",
    "StreamHealthRule",
    "IntentEligibilityRule",
    "IntentAllowlistRule",
    "IntentFreshnessRule",
    "ModelProvenanceRule",
    "EvidenceProvenanceRule",
    "OperatorHoldRule",
    "RateLimiterRule",
    "ActiveDurationRule",
    # Phase 17 Engine & FSM
    "SafetyRuleEngine",
    "SafetyArbitrationStateMachine",
    "SafetyArbitrationTransitionError",
    "SAFETY_ARBITRATION_TRANSITIONS",
    # Phase 17 Storage & Service
    "SafetyStorage",
    "SafetyService",
    "default_safety_service",
]
