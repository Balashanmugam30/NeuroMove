import { z } from "zod";
import { SafetyDecisionEnum } from "./enums";

export const SafetyArbitrationStateEnum = z.enum([
  "SAFE_IDLE",
  "EVALUATING",
  "AUTHORIZED",
  "HELD",
  "DENIED",
  "EMERGENCY_STOP",
  "LOCKED_OUT",
  "RESET_PENDING",
]);
export type SafetyArbitrationState = z.infer<typeof SafetyArbitrationStateEnum>;

export const RuleStatusEnum = z.enum(["PASS", "WARN", "HOLD", "FAIL", "UNKNOWN"]);
export type RuleStatus = z.infer<typeof RuleStatusEnum>;

export const RuleSeverityEnum = z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RuleSeverity = z.infer<typeof RuleSeverityEnum>;

export const SafetyRuleResultSchema = z.object({
  rule_id: z.string(),
  category: z.string(),
  status: RuleStatusEnum,
  severity: RuleSeverityEnum,
  reason_code: z.string(),
  message: z.string(),
  evidence: z.record(z.unknown()).default({}),
  evaluated_at: z.string(),
});
export type SafetyRuleResult = z.infer<typeof SafetyRuleResultSchema>;

export const SafetyEvaluationSchema = z.object({
  evaluation_id: z.string(),
  decision: SafetyDecisionEnum,
  state: SafetyArbitrationStateEnum,
  primary_reason: z.string(),
  precedence_rank: z.number().int(),
  all_reasons: z.array(z.string()),
  violated_rules: z.array(SafetyRuleResultSchema),
  passed_rules: z.array(SafetyRuleResultSchema),
  policy_version: z.string(),
  intent_id: z.string().nullable().optional(),
  intent_class: z.string().nullable().optional(),
  subject_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  model_version_id: z.string().nullable().optional(),
  confidence_score: z.number().nullable().optional(),
  confidence_evaluation_id: z.string().nullable().optional(),
  temporal_confirmation_id: z.string().nullable().optional(),
  evaluated_at: z.string(),
  duration_ms: z.number(),
});
export type SafetyEvaluation = z.infer<typeof SafetyEvaluationSchema>;

export const SafetyPolicySchema = z.object({
  policy_id: z.string(),
  version: z.string(),
  allowlisted_intents: z.array(z.string()),
  blocked_intents: z.array(z.string()),
  max_intent_age_ms: z.number().positive(),
  max_evaluation_age_ms: z.number().positive(),
  max_context_age_ms: z.number().positive(),
  max_authorized_duration_ms: z.number().positive(),
  maximum_command_rate: z.number().int().positive(),
  rate_window_ms: z.number().positive(),
  minimum_command_gap_ms: z.number().nonnegative(),
  critical_health_requirements: z.array(z.string()),
  operator_hold_enabled: z.boolean(),
  emergency_stop_enabled: z.boolean(),
  lockout_threshold: z.number().int().positive(),
  lockout_policy: z.string(),
  reset_requirements: z.array(z.string()),
  created_at: z.string(),
  checksum: z.string(),
});
export type SafetyPolicy = z.infer<typeof SafetyPolicySchema>;

export const SafetyContextSchema = z.object({
  system_health: z.record(z.string()),
  stream_health: z.object({
    stream_connected: z.boolean(),
    last_event_age_ms: z.number(),
    latency_ms: z.number().optional(),
    dropout_detected: z.boolean().optional(),
  }),
  sensor_health: z.object({
    signal_quality_score: z.number(),
    electrodes_valid: z.boolean(),
  }),
  intent_freshness: z.object({
    age_ms: z.number(),
    is_stale: z.boolean(),
  }),
  model_health: z.object({
    is_active: z.boolean(),
    is_rolled_back: z.boolean(),
    model_version_id: z.string(),
  }),
  session_validity: z.object({
    active_subject_id: z.string(),
    active_session_id: z.string(),
  }),
  operator_state: z.object({
    operator_hold: z.boolean(),
    operator_id: z.string().nullable().optional(),
    hold_reason: z.string().nullable().optional(),
    hold_timestamp: z.string().nullable().optional(),
  }),
  environment_state: z.record(z.unknown()).default({}),
  execution_rate: z.object({
    recent_authorizations_count: z.number().int(),
    rate_window_ms: z.number(),
    last_authorization_time: z.string().nullable().optional(),
  }),
  current_action_state: z.object({
    active_authorized_since: z.number().nullable().optional(),
  }),
  emergency_stop_state: z.object({
    is_active: z.boolean(),
    asserted_by: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    asserted_at: z.string().nullable().optional(),
  }),
  lockout_state: z.object({
    is_locked_out: z.boolean(),
    failure_count: z.number().int(),
    reason: z.string().nullable().optional(),
    locked_out_at: z.string().nullable().optional(),
  }),
});
export type SafetyContext = z.infer<typeof SafetyContextSchema>;

export const SafetyStateSnapshotSchema = z.object({
  snapshot_id: z.string(),
  current_state: SafetyArbitrationStateEnum,
  last_decision: SafetyDecisionEnum,
  active_intent_id: z.string().nullable().optional(),
  intent_class: z.string().nullable().optional(),
  primary_reason: z.string(),
  active_policy_version: z.string(),
  emergency_stop: z.boolean(),
  emergency_stop_reason: z.string().nullable().optional(),
  operator_hold: z.boolean(),
  operator_id: z.string().nullable().optional(),
  lockout: z.boolean(),
  lockout_reason: z.string().nullable().optional(),
  system_healthy: z.boolean(),
  stream_healthy: z.boolean(),
  last_evaluation_id: z.string().nullable().optional(),
  state_deadline: z.number().nullable().optional(),
  transition_count: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SafetyStateSnapshot = z.infer<typeof SafetyStateSnapshotSchema>;

export const SafetyTransitionSchema = z.object({
  transition_id: z.string(),
  sequence_number: z.number().int(),
  previous_state: SafetyArbitrationStateEnum,
  next_state: SafetyArbitrationStateEnum,
  trigger_name: z.string(),
  reason: z.string(),
  evaluation_id: z.string().nullable().optional(),
  intent_id: z.string().nullable().optional(),
  policy_version: z.string(),
  timestamp: z.string(),
  details: z.record(z.unknown()).nullable().optional(),
});
export type SafetyTransition = z.infer<typeof SafetyTransitionSchema>;

export const SafetyEvaluateRequestSchema = z.object({
  intent_snapshot: z.record(z.unknown()).nullable().optional(),
  context_override: z.record(z.unknown()).nullable().optional(),
  policy_id: z.string().nullable().optional(),
});
export type SafetyEvaluateRequest = z.infer<typeof SafetyEvaluateRequestSchema>;

export const SafetyHoldRequestSchema = z.object({
  operator_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export type SafetyHoldRequest = z.infer<typeof SafetyHoldRequestSchema>;

export const SafetyEmergencyStopRequestSchema = z.object({
  reason: z.string().nullable().optional(),
  asserted_by: z.string().nullable().optional(),
});
export type SafetyEmergencyStopRequest = z.infer<typeof SafetyEmergencyStopRequestSchema>;

export const SafetyResetRequestSchema = z.object({
  operator_id: z.string().nullable().optional(),
  clear_lockout: z.boolean().default(false),
});
export type SafetyResetRequest = z.infer<typeof SafetyResetRequestSchema>;

export const SafetyLockoutRequestSchema = z.object({
  reason: z.string(),
  operator_id: z.string().nullable().optional(),
});
export type SafetyLockoutRequest = z.infer<typeof SafetyLockoutRequestSchema>;

export const SafetyDiagnosticsSchema = z.object({
  evaluation_count: z.number().int(),
  authorized_count: z.number().int(),
  held_count: z.number().int(),
  denied_count: z.number().int(),
  emergency_stop_count: z.number().int(),
  lockout_count: z.number().int(),
  top_denial_reasons: z.record(z.number().int()),
  current_state_duration_ms: z.number(),
  health_failures: z.number().int(),
  rate_limit_violations: z.number().int(),
});
export type SafetyDiagnostics = z.infer<typeof SafetyDiagnosticsSchema>;

export const SafetyScenarioRunRequestSchema = z.object({
  scenario_id: z.string(),
});
export type SafetyScenarioRunRequest = z.infer<typeof SafetyScenarioRunRequestSchema>;

export const SafetyScenarioResultSchema = z.object({
  scenario_id: z.string(),
  name: z.string(),
  description: z.string(),
  expected_decision: SafetyDecisionEnum,
  actual_decision: SafetyDecisionEnum,
  expected_state: SafetyArbitrationStateEnum,
  actual_state: SafetyArbitrationStateEnum,
  passed: z.boolean(),
  steps_audit: z.array(z.record(z.unknown())),
  evaluation: SafetyEvaluationSchema.nullable().optional(),
});
export type SafetyScenarioResult = z.infer<typeof SafetyScenarioResultSchema>;
