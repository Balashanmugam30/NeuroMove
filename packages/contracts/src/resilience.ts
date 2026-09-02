import { z } from "zod";
import { SafetyDecisionEnum } from "./enums";
import { SafetyArbitrationStateEnum } from "./safety";
import { IntentLifecycleStateSchema } from "./intent";

// --- Enums ---

export const FaultCategoryEnum = z.enum([
  "TRANSPORT",
  "DATA",
  "MODEL",
  "CONFIDENCE",
  "INTENT",
  "SAFETY",
  "PERSISTENCE",
  "SERVICE",
  "TIMING",
  "CONTEXT",
]);
export type FaultCategory = z.infer<typeof FaultCategoryEnum>;

export const FaultTypeEnum = z.enum([
  // Transport
  "STREAM_DISCONNECT",
  "STREAM_DELAY",
  "STREAM_EVENT_DROP",
  "STREAM_EVENT_DUPLICATE",
  "STREAM_EVENT_REORDER",
  "STREAM_SEQUENCE_GAP",
  "WEBSOCKET_DISCONNECT",

  // Data
  "MALFORMED_PAYLOAD",
  "MISSING_FIELD",
  "INVALID_TIMESTAMP",
  "STALE_DATA",
  "CORRUPTED_FEATURES",
  "EMPTY_SAMPLE",

  // Model
  "MODEL_UNAVAILABLE",
  "MODEL_VERSION_MISMATCH",
  "MODEL_ROLLBACK",
  "MODEL_CORRUPTION_SIMULATED",
  "CALIBRATION_UNAVAILABLE",

  // Confidence
  "CONFIDENCE_SERVICE_UNAVAILABLE",
  "CONFIDENCE_OUTPUT_MISSING",
  "CONFIDENCE_STALE",
  "TEMPORAL_STATE_RESET",

  // Intent
  "INTENT_SERVICE_UNAVAILABLE",
  "INTENT_SNAPSHOT_MISSING",
  "INTENT_EVENT_DUPLICATE",
  "INTENT_EVENT_OUT_OF_ORDER",
  "INTENT_STATE_CORRUPTION_SIMULATED",

  // Safety
  "SAFETY_SERVICE_UNAVAILABLE",
  "SAFETY_CONTEXT_UNKNOWN",
  "SAFETY_POLICY_UNAVAILABLE",
  "SAFETY_EVALUATION_TIMEOUT",

  // Persistence
  "DATABASE_UNAVAILABLE",
  "DATABASE_WRITE_FAILURE",
  "DATABASE_READ_FAILURE",
  "TRANSACTION_ROLLBACK",
  "SNAPSHOT_UNAVAILABLE",

  // Service
  "SERVICE_RESTART",
  "SERVICE_TIMEOUT",
  "SERVICE_LATENCY",
  "DEPENDENCY_UNAVAILABLE",

  // Timing
  "CLOCK_SKEW_SIMULATED",
  "TIMESTAMP_DELAY",
  "EVENT_DELAY",
  "TIMEOUT_ACCELERATION",

  // Context
  "SUBJECT_SWITCH",
  "SESSION_SWITCH",
  "MODEL_CONTEXT_SWITCH",
  "ENVIRONMENT_CONTEXT_LOSS",
]);
export type FaultType = z.infer<typeof FaultTypeEnum>;

export const FaultSeverityEnum = z.enum([
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);
export type FaultSeverity = z.infer<typeof FaultSeverityEnum>;

export const FaultScopeEnum = z.enum([
  "SINGLE_EVENT",
  "WINDOW",
  "SESSION",
  "SERVICE",
  "GLOBAL_SIMULATION",
]);
export type FaultScope = z.infer<typeof FaultScopeEnum>;

export const FaultStatusEnum = z.enum([
  "DECLARED",
  "ARMED",
  "ACTIVE",
  "DETECTED",
  "RECOVERING",
  "CLEARED",
  "FAILED",
]);
export type FaultStatus = z.infer<typeof FaultStatusEnum>;

export const TriggerTypeEnum = z.enum([
  "MANUAL",
  "AFTER_N_EVENTS",
  "AT_SEQUENCE",
  "AT_TIMESTAMP",
  "AFTER_STATE",
  "AFTER_SCENARIO_STEP",
]);
export type TriggerType = z.infer<typeof TriggerTypeEnum>;

export const InvariantStatusEnum = z.enum(["PASS", "FAIL", "UNCERTAIN"]);
export type InvariantStatus = z.infer<typeof InvariantStatusEnum>;

export const RecoveryStatusEnum = z.enum([
  "RECOVERED_CLEANLY",
  "RECOVERED_RESTRICTIVELY",
  "RECOVERED_WITH_DATA_LOSS",
  "RECOVERY_FAILED",
  "RECOVERY_UNCERTAIN",
]);
export type RecoveryStatus = z.infer<typeof RecoveryStatusEnum>;

export const DataLossStatusEnum = z.enum([
  "NONE",
  "TRANSIENT",
  "AUDIT_ONLY",
  "NON_CRITICAL",
  "CRITICAL",
]);
export type DataLossStatus = z.infer<typeof DataLossStatusEnum>;

// --- Fault Specifications & Parameters ---

export const FaultParametersSchema = z.object({
  delay_ms: z.number().min(0).max(60000).optional(),
  drop_count: z.number().int().min(1).max(100).optional(),
  duplicate_count: z.number().int().min(1).max(100).optional(),
  reorder_offset: z.number().int().min(1).max(50).optional(),
  clock_skew_ms: z.number().min(-86400000).max(86400000).optional(),
  missing_fields: z.array(z.string()).optional(),
  invalid_values: z.record(z.unknown()).optional(),
  target_component: z.string().optional(),
  operation: z.string().optional(),
  failure_count: z.number().int().min(1).max(100).optional(),
  duration_ms: z.number().min(0).max(300000).optional(),
  custom_params: z.record(z.unknown()).optional(),
});
export type FaultParameters = z.infer<typeof FaultParametersSchema>;

export const FaultDefinitionSchema = z.object({
  fault_id: z.string(),
  fault_type: FaultTypeEnum,
  category: FaultCategoryEnum,
  severity: FaultSeverityEnum,
  scope: FaultScopeEnum,
  status: FaultStatusEnum,
  target_service: z.string().nullable().optional(),
  target_stream: z.string().nullable().optional(),
  target_session: z.string().nullable().optional(),
  trigger_type: TriggerTypeEnum,
  trigger_value: z.string().nullable().optional(),
  parameters: FaultParametersSchema,
  created_at: z.string(),
  armed_at: z.string().nullable().optional(),
  activated_at: z.string().nullable().optional(),
  cleared_at: z.string().nullable().optional(),
  description: z.string().optional(),
});
export type FaultDefinition = z.infer<typeof FaultDefinitionSchema>;

export const FaultInjectionRequestSchema = z.object({
  fault_type: FaultTypeEnum,
  severity: FaultSeverityEnum.default("MEDIUM"),
  scope: FaultScopeEnum.default("SINGLE_EVENT"),
  target_service: z.string().optional(),
  target_stream: z.string().optional(),
  target_session: z.string().optional(),
  trigger_type: TriggerTypeEnum.default("MANUAL"),
  trigger_value: z.string().optional(),
  parameters: FaultParametersSchema.default({}),
  description: z.string().optional(),
});
export type FaultInjectionRequest = z.infer<typeof FaultInjectionRequestSchema>;

export const FaultInjectionResultSchema = z.object({
  success: z.boolean(),
  fault: FaultDefinitionSchema,
  message: z.string(),
});
export type FaultInjectionResult = z.infer<typeof FaultInjectionResultSchema>;

// --- Invariant & Recovery Models ---

export const InvariantResultSchema = z.object({
  invariant_id: z.string(),
  name: z.string(),
  status: InvariantStatusEnum,
  severity: FaultSeverityEnum,
  observed_value: z.string(),
  expected_value: z.string(),
  evidence: z.record(z.unknown()),
  timestamp: z.string(),
});
export type InvariantResult = z.infer<typeof InvariantResultSchema>;

export const RecoveryCheckpointSchema = z.object({
  checkpoint_id: z.string(),
  experiment_id: z.string(),
  component: z.string(),
  last_known_safe_state: z.string(),
  sequence_number: z.number().int(),
  snapshot_version: z.string(),
  checksum: z.string(),
  timestamp: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type RecoveryCheckpoint = z.infer<typeof RecoveryCheckpointSchema>;

export const PipelineHealthSnapshotSchema = z.object({
  transport_healthy: z.boolean(),
  confidence_healthy: z.boolean(),
  intent_healthy: z.boolean(),
  safety_healthy: z.boolean(),
  database_healthy: z.boolean(),
  active_model_healthy: z.boolean(),
  active_faults_count: z.number().int(),
  current_safety_state: SafetyArbitrationStateEnum,
  current_safety_decision: SafetyDecisionEnum,
  current_intent_state: IntentLifecycleStateSchema.optional(),
  timestamp: z.string(),
});
export type PipelineHealthSnapshot = z.infer<typeof PipelineHealthSnapshotSchema>;

// --- Experiment Manifest & Execution ---

export const FaultExperimentManifestSchema = z.object({
  experiment_id: z.string(),
  experiment_name: z.string(),
  scenario_id: z.string(),
  seed: z.number().int(),
  created_at: z.string(),
  operator: z.string().default("researcher"),
  subject_id: z.string().default("sub-01"),
  session_id: z.string().default("sess-01"),
  starting_model_version: z.string().default("model_v1"),
  starting_confidence_config: z.string().default("default_v1"),
  starting_intent_policy: z.string().default("v1.0.0"),
  starting_safety_policy: z.string().default("1.0.0"),
  fault_sequence: z.array(FaultDefinitionSchema),
  expected_invariants: z.array(z.string()),
  manifest_checksum: z.string(),
});
export type FaultExperimentManifest = z.infer<typeof FaultExperimentManifestSchema>;

export const FaultExperimentSchema = z.object({
  experiment_id: z.string(),
  scenario_id: z.string(),
  name: z.string(),
  seed: z.number().int(),
  status: z.enum(["RUNNING", "PASSED", "FAILED", "UNCERTAIN"]),
  manifest: FaultExperimentManifestSchema,
  baseline_snapshot: PipelineHealthSnapshotSchema,
  final_snapshot: PipelineHealthSnapshotSchema,
  invariants: z.array(InvariantResultSchema),
  recovery_status: RecoveryStatusEnum,
  data_loss_status: DataLossStatusEnum,
  authorization_before_failure: z.boolean(),
  authorization_during_failure: z.boolean(),
  authorization_after_failure: z.boolean(),
  steps_audit: z.array(z.record(z.unknown())),
  replay_hash: z.string(),
  artifact_checksum: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  duration_ms: z.number().default(0),
});
export type FaultExperiment = z.infer<typeof FaultExperimentSchema>;

export const ResilienceMetricsSchema = z.object({
  total_experiments: z.number().int(),
  passed_experiments: z.number().int(),
  failed_experiments: z.number().int(),
  uncertain_experiments: z.number().int(),
  total_invariants_checked: z.number().int(),
  invariants_passed: z.number().int(),
  invariants_failed: z.number().int(),
  accidental_authorizations: z.number().int(),
  fail_closed_certifications: z.number().int(),
  replays_executed: z.number().int(),
  replays_matched: z.number().int(),
  active_faults_count: z.number().int(),
});
export type ResilienceMetrics = z.infer<typeof ResilienceMetricsSchema>;

export const FailureScenarioResultSchema = z.object({
  scenario_id: z.string(),
  name: z.string(),
  category: FaultCategoryEnum,
  description: z.string(),
  passed: z.boolean(),
  fail_closed_certified: z.boolean(),
  expected_safety_decision: SafetyDecisionEnum,
  observed_safety_decision: SafetyDecisionEnum,
  expected_safety_state: SafetyArbitrationStateEnum,
  observed_safety_state: SafetyArbitrationStateEnum,
  recovery_status: RecoveryStatusEnum,
  experiment_id: z.string(),
  steps_audit: z.array(z.record(z.unknown())),
  replay_hash: z.string(),
});
export type FailureScenarioResult = z.infer<typeof FailureScenarioResultSchema>;

export const ResilienceLabStatusSchema = z.object({
  lab_mode: z.enum(["IDLE", "EXPERIMENT_ACTIVE", "RECOVERING", "SIMULATION"]),
  active_faults: z.array(FaultDefinitionSchema),
  pipeline_health: PipelineHealthSnapshotSchema,
  metrics: ResilienceMetricsSchema,
  updated_at: z.string(),
});
export type ResilienceLabStatus = z.infer<typeof ResilienceLabStatusSchema>;
