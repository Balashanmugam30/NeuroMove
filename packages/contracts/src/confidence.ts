import { z } from "zod";

// ============================================================================
// 1. Core Enumerations & Schema Constants
// ============================================================================

export const ScoreTypeSchema = z.enum([
  "PROBABILITY",
  "DECISION_MARGIN",
  "CALIBRATED_PROBABILITY",
  "VOTE_RATIO",
]);
export type ScoreType = z.infer<typeof ScoreTypeSchema>;

export const ConfidenceEligibilitySchema = z.enum([
  "VALID",
  "LOW_SIGNAL",
  "STALE",
  "MODEL_INVALID",
  "UNCALIBRATED",
  "INCOMPATIBLE",
  "NO_PREDICTION",
  "INSUFFICIENT_MARGIN",
  "INSUFFICIENT_CONFIDENCE",
]);
export type ConfidenceEligibility = z.infer<typeof ConfidenceEligibilitySchema>;

export const ConfidenceBandSchema = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
]);
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;

export const FreshnessStatusSchema = z.enum([
  "FRESH",
  "AGING",
  "STALE",
  "UNKNOWN",
]);
export type FreshnessStatus = z.infer<typeof FreshnessStatusSchema>;

export const ModelValidityStatusSchema = z.enum([
  "ACTIVE",
  "VALIDATED",
  "NOT_EXPIRED",
  "COMPATIBLE",
  "NOT_ROLLED_BACK",
  "INACTIVE",
  "INVALID",
  "ROLLED_BACK",
]);
export type ModelValidityStatus = z.infer<typeof ModelValidityStatusSchema>;

export const CalibrationMethodSchema = z.enum([
  "PLATT",
  "ISOTONIC",
  "IDENTITY",
  "MARGIN_SIGMOID",
]);
export type CalibrationMethod = z.infer<typeof CalibrationMethodSchema>;

export const CalibrationScopeSchema = z.enum([
  "GLOBAL",
  "MODEL",
  "SUBJECT",
  "SESSION",
]);
export type CalibrationScope = z.infer<typeof CalibrationScopeSchema>;

export const TemporalStatusSchema = z.enum([
  "IDLE",
  "TRACKING",
  "CONFIRMED",
  "COOLDOWN",
  "REFRACTORY",
  "STALE",
  "REJECTED",
  "RESET",
]);
export type TemporalStatus = z.infer<typeof TemporalStatusSchema>;

export const TemporalResetReasonSchema = z.enum([
  "CLASS_CHANGED",
  "SIGNAL_INVALID",
  "STALE_DATA",
  "MODEL_CHANGED",
  "SESSION_CHANGED",
  "SUBJECT_CHANGED",
  "MANUAL_RESET",
  "TIMEOUT",
  "STREAM_INTERRUPTION",
  "COOLDOWN_EXPIRED",
]);
export type TemporalResetReason = z.infer<typeof TemporalResetReasonSchema>;

// ============================================================================
// 2. Configuration & Calibration Schemas
// ============================================================================

export const ConfidenceConfigSchema = z.object({
  config_id: z.string(),
  version: z.string(),
  scope: CalibrationScopeSchema,
  subject_id: z.string().optional().nullable(),
  model_version_id: z.string().optional().nullable(),
  high_threshold: z.number().min(0.0).max(1.0).default(0.75),
  medium_threshold: z.number().min(0.0).max(1.0).default(0.55),
  min_eligible_confidence: z.number().min(0.0).max(1.0).default(0.40),
  min_consecutive_windows: z.number().int().min(1).default(3),
  min_duration_ms: z.number().min(0.0).default(500.0),
  max_gap_ms: z.number().min(0.0).default(500.0),
  cooldown_ms: z.number().min(0.0).default(1000.0),

  refractory_ms: z.number().min(0.0).default(500.0),
  hysteresis_enter: z.number().min(0.0).max(1.0).default(0.75),
  hysteresis_exit: z.number().min(0.0).max(1.0).default(0.60),
  max_age_ms: z.number().min(0.0).default(400.0),
  quality_floor: z.number().min(0.0).max(1.0).default(0.50),
  allow_same_class_reconfirmation: z.boolean().default(false),
  parameters: z.record(z.any()).default({}),
  created_at: z.string(),
  checksum: z.string(),
});
export type ConfidenceConfig = z.infer<typeof ConfidenceConfigSchema>;

export const ReliabilityBinSchema = z.object({
  bin_center: z.number(),
  empirical_prob: z.number(),
  mean_confidence: z.number(),
  count: z.number().int(),
});
export type ReliabilityBin = z.infer<typeof ReliabilityBinSchema>;

export const CalibrationMetricsSchema = z.object({
  brier_score: z.number(),
  log_loss: z.number(),
  expected_calibration_error: z.number(),
  rejection_rate: z.number(),
  coverage: z.number(),
  precision_at_high_confidence: z.number(),
  reliability_curve: z.array(ReliabilityBinSchema),
});
export type CalibrationMetrics = z.infer<typeof CalibrationMetricsSchema>;

export const ConfidenceCalibrationProfileSchema = z.object({
  calibration_id: z.string(),
  model_version_id: z.string(),
  scope: CalibrationScopeSchema,
  subject_id: z.string().optional().nullable(),
  method: CalibrationMethodSchema,
  fit_dataset_reference: z.string(),
  parameters: z.record(z.any()),
  calibration_metrics: CalibrationMetricsSchema,
  status: z.string().default("ACTIVE"),
  checksum: z.string(),
  fit_timestamp: z.string(),
});
export type ConfidenceCalibrationProfile = z.infer<typeof ConfidenceCalibrationProfileSchema>;

// ============================================================================
// 3. Runtime Inputs & Multi-Factor Components
// ============================================================================

export const ConfidenceInputSchema = z.object({
  prediction: z.string(),
  raw_score: z.number(),
  score_type: ScoreTypeSchema,
  class_scores: z.record(z.number()).optional().nullable(),
  class_margin: z.number().optional().nullable(),
  model_id: z.string(),
  model_version_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  window_id: z.string().optional().nullable(),
  prediction_timestamp: z.number(),
  data_timestamp: z.number(),
  signal_quality: z.number().min(0.0).max(1.0).default(1.0),
  feature_compatibility: z.boolean().default(true),
  model_validity: ModelValidityStatusSchema.default("ACTIVE"),
  calibration_status: z.string().default("CALIBRATED"),
});
export type ConfidenceInput = z.infer<typeof ConfidenceInputSchema>;

export const ConfidenceComponentsSchema = z.object({
  model_score_component: z.number().min(0.0).max(1.0),
  class_margin_component: z.number().min(0.0).max(1.0),
  signal_quality_component: z.number().min(0.0).max(1.0),
  freshness_component: z.number().min(0.0).max(1.0),
  model_validity_component: z.number().min(0.0).max(1.0),
  calibration_component: z.number().min(0.0).max(1.0),
});
export type ConfidenceComponents = z.infer<typeof ConfidenceComponentsSchema>;

export const ConfidenceDecisionSchema = z.object({
  decision_id: z.string(),
  prediction: z.string(),
  raw_score: z.number(),
  score_type: ScoreTypeSchema,
  normalized_score: z.number().min(0.0).max(1.0),
  calibrated_confidence: z.number().min(0.0).max(1.0),
  confidence_band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  class_margin: z.number(),
  runner_up_class: z.string().optional().nullable(),
  signal_quality: z.number().min(0.0).max(1.0),
  freshness: FreshnessStatusSchema,
  model_validity: ModelValidityStatusSchema,
  components: ConfidenceComponentsSchema,
  decision_reason: z.string(),
  timestamp: z.number(),
  model_version_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
});
export type ConfidenceDecision = z.infer<typeof ConfidenceDecisionSchema>;

// ============================================================================
// 4. Temporal Confirmation Schemas
// ============================================================================

export const TemporalConfirmationStateSchema = z.object({
  status: TemporalStatusSchema,
  current_candidate: z.string().nullable(),
  candidate_started_at: z.number().nullable(),
  consecutive_count: z.number().int().nonnegative(),
  accumulated_duration_ms: z.number().nonnegative(),
  last_evidence_at: z.number().nullable(),
  confirmation_count: z.number().int().nonnegative(),
  reset_count: z.number().int().nonnegative(),
  cooldown_until: z.number().nullable(),
  refractory_until: z.number().nullable(),
  active_model_version_id: z.string().nullable(),
  active_subject_id: z.string().nullable(),
  active_session_id: z.string().nullable(),
  last_reset_reason: TemporalResetReasonSchema.nullable(),
});
export type TemporalConfirmationState = z.infer<typeof TemporalConfirmationStateSchema>;

export const TemporalConfirmationDecisionSchema = z.object({
  temporally_confirmed: z.boolean(),
  confirmed_prediction: z.string().nullable(),
  confidence: z.number().min(0.0).max(1.0),
  confidence_band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  temporal_status: TemporalStatusSchema,
  consecutive_count: z.number().int().nonnegative(),
  accumulated_duration_ms: z.number().nonnegative(),
  required_count: z.number().int().positive(),
  required_duration_ms: z.number().nonnegative(),
  confirmation_timestamp: z.number().nullable(),
  decision_reason: z.string(),
  model_version_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
});
export type TemporalConfirmationDecision = z.infer<typeof TemporalConfirmationDecisionSchema>;

// ============================================================================
// 5. Phase 16 Intent Handoff Contract
// ============================================================================

export const Phase16IntentHandoffPayloadSchema = z.object({
  prediction: z.string(),
  confidence: z.number().min(0.0).max(1.0),
  confidence_band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  temporal_status: TemporalStatusSchema,
  temporally_confirmed: z.boolean(),
  confirmation_timestamp: z.number().nullable(),
  confirmation_reason: z.string(),
  model_version_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  evidence_window_count: z.number().int().nonnegative(),
  evidence_duration_ms: z.number().nonnegative(),
});
export type Phase16IntentHandoffPayload = z.infer<typeof Phase16IntentHandoffPayloadSchema>;

// ============================================================================
// 6. Persistence & History Records
// ============================================================================

export const ConfidenceHistoryRecordSchema = z.object({
  history_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  model_version_id: z.string(),
  predicted_class: z.string(),
  confidence: z.number(),
  band: ConfidenceBandSchema,
  eligibility: ConfidenceEligibilitySchema,
  temporal_status: TemporalStatusSchema,
  decision_reason: z.string(),
  timestamp: z.string(),
});
export type ConfidenceHistoryRecord = z.infer<typeof ConfidenceHistoryRecordSchema>;

export const TemporalConfirmationEventSchema = z.object({
  event_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  event_type: z.string(),
  candidate_class: z.string().optional().nullable(),
  consecutive_windows: z.number().int().nonnegative(),
  accumulated_duration_ms: z.number().nonnegative(),
  confidence_score: z.number(),
  decision_reason: z.string(),
  model_version_id: z.string(),
  subject_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  timestamp: z.string(),
});
export type TemporalConfirmationEvent = z.infer<typeof TemporalConfirmationEventSchema>;
