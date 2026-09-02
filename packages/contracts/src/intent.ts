import { z } from "zod";
import { ConfidenceBandSchema, ConfidenceEligibilitySchema } from "./confidence";

// Canonical Intent Lifecycle States
export const IntentLifecycleStateSchema = z.enum([
  "NO_INTENT",
  "CANDIDATE",
  "CONFIRMED",
  "ACTIVE",
  "REPLACEMENT_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "INTERRUPTED",
]);
export type IntentLifecycleState = z.infer<typeof IntentLifecycleStateSchema>;

// Transition Triggers
export const IntentTransitionTriggerSchema = z.enum([
  "HANDOFF_CANDIDATE",
  "HANDOFF_CONFIRMED",
  "ACCEPT_ACTIVE",
  "TIMEOUT",
  "EXPLICIT_CANCEL",
  "EXPLICIT_COMPLETE",
  "INTERRUPTION",
  "REPLACEMENT_REQUEST",
  "REPLACEMENT_RESOLVE",
  "CONTEXT_RESET",
]);
export type IntentTransitionTrigger = z.infer<typeof IntentTransitionTriggerSchema>;

// Machine-readable Transition Reasons
export const IntentTransitionReasonSchema = z.enum([
  "TEMPORAL_CONFIRMATION_ACCEPTED",
  "CANDIDATE_CREATED",
  "CANDIDATE_TIMEOUT",
  "CONFIRMATION_TIMEOUT",
  "ACTIVE_TIMEOUT",
  "INVALID_HANDOFF",
  "SUBJECT_CHANGED",
  "SESSION_CHANGED",
  "MODEL_CHANGED",
  "EXPLICIT_CANCEL",
  "EXPLICIT_COMPLETE",
  "INTERRUPTION",
  "REPLACEMENT_REQUESTED",
  "REPLACEMENT_ACCEPTED",
  "REPLACEMENT_REJECTED",
  "CONTEXT_LOST",
  "REST_PREDICTION",
  "STATE_RESTORE",
  "MANUAL_RESET",
]);
export type IntentTransitionReason = z.infer<typeof IntentTransitionReasonSchema>;

// Intent Policy Configuration
export const IntentPolicySchema = z.object({
  policy_id: z.string(),
  version: z.string(),
  candidate_timeout_ms: z.number().positive(),
  confirmation_acceptance_window_ms: z.number().positive(),
  active_intent_timeout_ms: z.number().positive(),
  allow_replacement: z.boolean(),
  replacement_requires_confirmation: z.boolean(),
  same_class_reconfirmation_cooldown_ms: z.number().nonnegative(),
  cross_class_replacement_policy: z.enum(["IMMEDIATE", "REQUIRE_CONFIRMATION", "REJECT"]),
  subject_change_policy: z.enum(["INTERRUPT_AND_RESET", "REJECT"]),
  session_change_policy: z.enum(["INTERRUPT_AND_RESET", "REJECT"]),
  model_change_policy: z.enum(["INTERRUPT_AND_RESET", "REJECT"]),
  rest_handling_policy: z.enum(["CANCEL_CANDIDATE", "INTERRUPT_ACTIVE", "IGNORE"]),
  parameters: z.record(z.any()).default({}),
  created_at: z.string(),
  checksum: z.string(),
});
export type IntentPolicy = z.infer<typeof IntentPolicySchema>;

// Intent Entity Record
export const IntentRecordSchema = z.object({
  intent_id: z.string(),
  intent_class: z.string(),
  current_state: IntentLifecycleStateSchema,
  subject_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  model_version_id: z.string(),
  confidence_score: z.number().min(0.0).max(1.0),
  confidence_band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  source_event_id: z.string().nullable().optional(),
  confidence_evaluation_id: z.string().nullable().optional(),
  temporal_confirmation_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  state_deadline: z.number().nullable().optional(),
  is_terminal: z.boolean(),
  terminal_reason: IntentTransitionReasonSchema.nullable().optional(),
  policy_version: z.string(),
});
export type IntentRecord = z.infer<typeof IntentRecordSchema>;

// Historical State Transition
export const IntentStateTransitionSchema = z.object({
  transition_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  intent_id: z.string().nullable().optional(),
  intent_class: z.string().nullable().optional(),
  previous_state: IntentLifecycleStateSchema,
  next_state: IntentLifecycleStateSchema,
  trigger: IntentTransitionTriggerSchema,
  reason: IntentTransitionReasonSchema,
  subject_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  model_version_id: z.string().nullable().optional(),
  source_event_id: z.string().nullable().optional(),
  confidence_score: z.number().min(0.0).max(1.0).nullable().optional(),
  policy_version: z.string(),
  timestamp: z.string(),
  details: z.string().optional(),
});
export type IntentStateTransition = z.infer<typeof IntentStateTransitionSchema>;

// Authoritative Intent State Snapshot (Consumed by Phase 17 Safety Arbitration)
export const IntentStateSnapshotSchema = z.object({
  snapshot_id: z.string(),
  active_intent_id: z.string().nullable(),
  current_state: IntentLifecycleStateSchema,
  intent_class: z.string().nullable(),
  subject_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  model_version_id: z.string().nullable(),
  confidence_score: z.number().min(0.0).max(1.0).nullable().optional(),
  confidence_evaluation_id: z.string().nullable().optional(),
  temporal_confirmation_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  state_deadline: z.number().nullable().optional(),
  transition_reason: IntentTransitionReasonSchema,
  policy_version: z.string(),
  transition_count: z.number().int().nonnegative(),
});
export type IntentStateSnapshot = z.infer<typeof IntentStateSnapshotSchema>;

// Ingest Handoff Request Payload
export const IntentIngestRequestSchema = z.object({
  prediction: z.string(),
  confidence: z.number().min(0.0).max(1.0),
  confidence_band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  temporal_status: z.string(),
  temporally_confirmed: z.boolean(),
  confirmation_timestamp: z.number().nullable().optional(),
  confirmation_reason: z.string(),
  model_version_id: z.string(),
  subject_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  evidence_window_count: z.number().int().nonnegative().optional(),
  evidence_duration_ms: z.number().nonnegative().optional(),
  source_event_id: z.string().nullable().optional(),
});

export type IntentIngestRequest = z.infer<typeof IntentIngestRequestSchema>;

// Action Requests
export const IntentCancelRequestSchema = z.object({
  intent_id: z.string().optional(),
  reason: IntentTransitionReasonSchema.optional().default("EXPLICIT_CANCEL"),
  details: z.string().optional(),
});
export type IntentCancelRequest = z.infer<typeof IntentCancelRequestSchema>;

export const IntentCompleteRequestSchema = z.object({
  intent_id: z.string().optional(),
  reason: IntentTransitionReasonSchema.optional().default("EXPLICIT_COMPLETE"),
  details: z.string().optional(),
});
export type IntentCompleteRequest = z.infer<typeof IntentCompleteRequestSchema>;

export const IntentResetRequestSchema = z.object({
  reason: IntentTransitionReasonSchema.optional().default("MANUAL_RESET"),
  details: z.string().optional(),
});
export type IntentResetRequest = z.infer<typeof IntentResetRequestSchema>;

// Simulation Scenario Result
export const IntentScenarioStepSchema = z.object({
  step: z.number().int().positive(),
  action: z.string(),
  previous_state: IntentLifecycleStateSchema,
  next_state: IntentLifecycleStateSchema,
  intent_id: z.string().nullable().optional(),
  intent_class: z.string().nullable().optional(),
  reason: IntentTransitionReasonSchema,
  note: z.string().optional(),
});
export type IntentScenarioStep = z.infer<typeof IntentScenarioStepSchema>;

export const IntentScenarioResponseSchema = z.object({
  scenario_id: z.string(),
  executed_at: z.string(),
  passed: z.boolean(),
  results: z.array(IntentScenarioStepSchema),
  final_snapshot: IntentStateSnapshotSchema,
});
export type IntentScenarioResponse = z.infer<typeof IntentScenarioResponseSchema>;
