import { z } from "zod";
import { NormalizedLabelSchema } from "./epoching";
import { ModelFamilySchema, FeatureRepresentationSchema } from "./experiments";
import { ConfusionMatrixDataSchema } from "./decoding";


// ============================================================================
// 1. Enums & Literal Schemas for Phase 14 Adaptive Learning
// ============================================================================

export const AdaptationModeSchema = z.enum([
  "BATCH_ADAPTATION",
  "CALIBRATION_REFRESH",
  "PERSONALIZED_REFRESH",
]);
export type AdaptationMode = z.infer<typeof AdaptationModeSchema>;

export const AdaptationScopeSchema = z.enum(["SUBJECT", "POPULATION"]);
export type AdaptationScope = z.infer<typeof AdaptationScopeSchema>;

export const ModelLifecycleStatusSchema = z.enum([
  "ACTIVE_RESEARCH",
  "CANDIDATE",
  "VALIDATED",
  "REJECTED",
  "ROLLED_BACK",
  "ARCHIVED",
  "STALE",
  "INVALID",
]);
export type ModelLifecycleStatus = z.infer<typeof ModelLifecycleStatusSchema>;

export const AdaptationRunStatusSchema = z.enum([
  "PLANNED",
  "VALIDATING_DATA",
  "BUILDING_TRAINING_SET",
  "TRAINING",
  "VALIDATING",
  "COMPARING",
  "APPROVAL_PENDING",
  "PROMOTED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "ROLLED_BACK",
]);
export type AdaptationRunStatus = z.infer<typeof AdaptationRunStatusSchema>;

export const DataRetentionStrategySchema = z.enum([
  "NEW_DATA_ONLY",
  "NEW_PLUS_RETAINED_DATA",
  "BASELINE_PLUS_NEW",
]);
export type DataRetentionStrategy = z.infer<typeof DataRetentionStrategySchema>;

export const ClassImbalancePolicySchema = z.enum(["REJECT", "WARN", "ALLOW"]);
export type ClassImbalancePolicy = z.infer<typeof ClassImbalancePolicySchema>;

export const PromotionDecisionStatusSchema = z.enum([
  "PROMOTED",
  "REJECTED",
  "PENDING_REVIEW",
]);
export type PromotionDecisionStatus = z.infer<typeof PromotionDecisionStatusSchema>;

export const DriftStatusSchema = z.enum([
  "STABLE",
  "MONITOR",
  "SHIFT_DETECTED",
  "INSUFFICIENT_DATA",
  "NOT_EVALUATED",
]);
export type DriftStatus = z.infer<typeof DriftStatusSchema>;

// ============================================================================
// 2. Adaptation Policy Schemas
// ============================================================================

export const AdaptationPolicySchema = z.object({
  policy_id: z.string(),
  policy_version: z.string().default("ADAPTATION_POLICY_V1"),
  name: z.string(),
  description: z.string().nullable().optional(),
  mode: AdaptationModeSchema.default("BATCH_ADAPTATION"),
  scope: AdaptationScopeSchema.default("SUBJECT"),
  min_new_trials: z.number().int().positive().default(10),
  min_trials_per_class: z.number().int().positive().default(4),
  max_rejection_ratio: z.number().min(0.0).max(1.0).default(0.4),
  retention_strategy: DataRetentionStrategySchema.default("BASELINE_PLUS_NEW"),
  imbalance_policy: ClassImbalancePolicySchema.default("WARN"),
  max_allowed_regression: z.number().min(0.0).max(1.0).default(0.05),
  min_promoted_balanced_accuracy: z.number().min(0.0).max(1.0).default(0.6),
  min_validation_samples: z.number().int().positive().default(6),
  validation_strategy: z.string().default("PROTECTED_HOLDOUT"),
  random_state: z.number().int().default(42),
  created_at: z.string(),
});
export type AdaptationPolicy = z.infer<typeof AdaptationPolicySchema>;

export const CreateAdaptationPolicyRequestSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  mode: AdaptationModeSchema.default("BATCH_ADAPTATION"),
  scope: AdaptationScopeSchema.default("SUBJECT"),
  min_new_trials: z.number().int().positive().default(10),
  min_trials_per_class: z.number().int().positive().default(4),
  max_rejection_ratio: z.number().min(0.0).max(1.0).default(0.4),
  retention_strategy: DataRetentionStrategySchema.default("BASELINE_PLUS_NEW"),
  imbalance_policy: ClassImbalancePolicySchema.default("WARN"),
  max_allowed_regression: z.number().min(0.0).max(1.0).default(0.05),
  min_promoted_balanced_accuracy: z.number().min(0.0).max(1.0).default(0.6),
  min_validation_samples: z.number().int().positive().default(6),
  random_state: z.number().int().default(42),
});
export type CreateAdaptationPolicyRequest = z.infer<typeof CreateAdaptationPolicyRequestSchema>;

// ============================================================================
// 3. Adaptation Data Batch Schemas
// ============================================================================

export const AdaptationDataBatchSchema = z.object({
  batch_id: z.string(),
  name: z.string(),
  subject_id: z.string().nullable().optional(),
  source_mode: z.enum(["SIMULATION", "REPLAY"]),
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  epoch_set_id: z.string().nullable().optional(),
  feature_set_id: z.string().nullable().optional(),
  trial_count: z.number().int().nonnegative(),
  class_distribution: z.record(z.string(), z.number().int().nonnegative()),
  quality_summary: z.object({
    total_trials: z.number().int(),
    valid_trials: z.number().int(),
    rejected_trials: z.number().int(),
    warn_trials: z.number().int(),
    valid_ratio: z.number(),
    rejection_ratio: z.number(),
    is_sufficient: z.boolean(),
  }),
  source_fingerprint: z.string(),
  created_at: z.string(),
});
export type AdaptationDataBatch = z.infer<typeof AdaptationDataBatchSchema>;

// ============================================================================
// 4. Model Version Graph Schemas
// ============================================================================

export const ModelVersionSchema = z.object({
  version_id: z.string(),
  model_id: z.string(),
  parent_model_id: z.string().nullable().optional(),
  version_number: z.number().int().positive(),
  scope: AdaptationScopeSchema,
  subject_id: z.string().nullable().optional(),
  status: ModelLifecycleStatusSchema,
  is_active: z.boolean().default(false),
  adaptation_id: z.string().nullable().optional(),
  model_family: ModelFamilySchema,
  representation: FeatureRepresentationSchema,
  task_id: z.string(),
  metrics: z.object({
    accuracy: z.number(),
    balanced_accuracy: z.number(),
    f1: z.number(),
    precision: z.number().optional(),
    recall: z.number().optional(),
  }),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
});
export type ModelVersion = z.infer<typeof ModelVersionSchema>;

// ============================================================================
// 5. Pre-flight Adaptation Preview Schemas
// ============================================================================

export const AdaptationPreviewRequestSchema = z.object({
  base_model_id: z.string(),
  data_batch_ids: z.array(z.string()).min(1),
  policy_id: z.string(),
  scope: AdaptationScopeSchema.default("SUBJECT"),
  subject_id: z.string().nullable().optional(),
});
export type AdaptationPreviewRequest = z.infer<typeof AdaptationPreviewRequestSchema>;

export const AdaptationPreviewSchema = z.object({
  base_model_id: z.string(),
  base_model_version: z.number().int().positive(),
  scope: AdaptationScopeSchema,
  subject_id: z.string().nullable().optional(),
  policy_id: z.string(),
  policy_name: z.string(),
  compatibility_status: z.enum(["COMPATIBLE", "INCOMPATIBLE", "WARNING"]),
  compatibility_issues: z.array(z.string()),
  duplicate_epoch_count: z.number().int().nonnegative(),
  data_composition: z.object({
    base_retained_trials: z.number().int().nonnegative(),
    new_candidate_trials: z.number().int().nonnegative(),
    total_training_trials: z.number().int().nonnegative(),
    protected_validation_trials: z.number().int().nonnegative(),
  }),
  class_balance: z.record(z.string(), z.number()),
  promotion_requirements: z.array(z.string()),
  can_proceed: z.boolean(),
});
export type AdaptationPreview = z.infer<typeof AdaptationPreviewSchema>;

// ============================================================================
// 6. Adaptation Run & Evaluation Schemas
// ============================================================================

export const StartAdaptationRunRequestSchema = z.object({
  base_model_id: z.string(),
  data_batch_ids: z.array(z.string()).min(1),
  policy_id: z.string(),
  scope: AdaptationScopeSchema.default("SUBJECT"),
  subject_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type StartAdaptationRunRequest = z.infer<typeof StartAdaptationRunRequestSchema>;

export const CandidateComparisonSchema = z.object({
  incumbent_model_id: z.string(),
  candidate_model_id: z.string(),
  task_id: z.string(),
  validation_sample_count: z.number().int().positive(),
  incumbent_balanced_accuracy: z.number(),
  candidate_balanced_accuracy: z.number(),
  delta_balanced_accuracy: z.number(),
  incumbent_f1: z.number(),
  candidate_f1: z.number(),
  delta_f1: z.number(),
  incumbent_accuracy: z.number(),
  candidate_accuracy: z.number(),
  delta_accuracy: z.number(),
  chance_level: z.number().default(0.5),
  incumbent_confusion_matrix: ConfusionMatrixDataSchema,
  candidate_confusion_matrix: ConfusionMatrixDataSchema,
  error_analysis: z.object({
    fixed_errors: z.number().int().nonnegative(),
    new_errors: z.number().int().nonnegative(),
    persistent_errors: z.number().int().nonnegative(),
  }),
  is_regression: z.boolean(),
  regression_amount: z.number().nonnegative(),
});
export type CandidateComparison = z.infer<typeof CandidateComparisonSchema>;

export const PolicyCriterionResultSchema = z.object({
  criterion_name: z.string(),
  expected_rule: z.string(),
  observed_value: z.any(),
  passed: z.boolean(),
});
export type PolicyCriterionResult = z.infer<typeof PolicyCriterionResultSchema>;

export const PromotionEligibilitySchema = z.object({
  is_eligible: z.boolean(),
  criteria_results: z.array(PolicyCriterionResultSchema),
  failure_reasons: z.array(z.string()),
});
export type PromotionEligibility = z.infer<typeof PromotionEligibilitySchema>;

export const AdaptationRunSchema = z.object({
  adaptation_id: z.string(),
  base_model_id: z.string(),
  candidate_model_id: z.string().nullable().optional(),
  policy_id: z.string(),
  scope: AdaptationScopeSchema,
  subject_id: z.string().nullable().optional(),
  data_batch_ids: z.array(z.string()),
  status: AdaptationRunStatusSchema,
  training_composition: z.object({
    base_retained_count: z.number().int().nonnegative(),
    new_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
    fingerprint: z.string(),
  }),
  validation_composition: z.object({
    protected_count: z.number().int().nonnegative(),
    fingerprint: z.string(),
  }),
  leakage_check: z.object({
    overlap_count: z.number().int().nonnegative(),
    is_leakage_safe: z.boolean(),
  }),
  incumbent_metrics: z.object({
    accuracy: z.number(),
    balanced_accuracy: z.number(),
    f1: z.number(),
  }),
  candidate_metrics: z.object({
    accuracy: z.number(),
    balanced_accuracy: z.number(),
    f1: z.number(),
  }).nullable().optional(),
  comparison: CandidateComparisonSchema.nullable().optional(),
  promotion_eligibility: PromotionEligibilitySchema.nullable().optional(),
  promotion_decision: z.object({
    decision: PromotionDecisionStatusSchema,
    operator_action: z.string(),
    reasons: z.array(z.string()),
    timestamp: z.string(),
  }).nullable().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
export type AdaptationRun = z.infer<typeof AdaptationRunSchema>;

// ============================================================================
// 7. Promotion, Rejection & Rollback Schemas
// ============================================================================

export const PromoteCandidateRequestSchema = z.object({
  adaptation_id: z.string(),
  operator_notes: z.string().nullable().optional(),
});
export type PromoteCandidateRequest = z.infer<typeof PromoteCandidateRequestSchema>;

export const RejectCandidateRequestSchema = z.object({
  adaptation_id: z.string(),
  rejection_reason: z.string(),
});
export type RejectCandidateRequest = z.infer<typeof RejectCandidateRequestSchema>;

export const PromotionDecisionSchema = z.object({
  decision_id: z.string(),
  adaptation_id: z.string(),
  base_model_id: z.string(),
  candidate_model_id: z.string(),
  decision: PromotionDecisionStatusSchema,
  decision_rule_version: z.string().default("PROMOTION_RULE_V1"),
  operator_action: z.string(),
  reasons: z.array(z.string()),
  metrics_summary: z.record(z.string(), z.any()),
  timestamp: z.string(),
});
export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>;

export const RollbackRequestSchema = z.object({
  target_model_id: z.string(),
  reason: z.string(),
});
export type RollbackRequest = z.infer<typeof RollbackRequestSchema>;

export const RollbackEventSchema = z.object({
  rollback_id: z.string(),
  from_model_id: z.string(),
  to_model_id: z.string(),
  reason: z.string(),
  operator_action: z.string().default("MANUAL_ROLLBACK"),
  timestamp: z.string(),
});
export type RollbackEvent = z.infer<typeof RollbackEventSchema>;

// ============================================================================
// 8. Drift Observation Schemas
// ============================================================================

export const DriftObservationSchema = z.object({
  observation_id: z.string(),
  subject_id: z.string().nullable().optional(),
  dataset_id: z.string().nullable().optional(),
  window_label: z.string(),
  feature_shift_score: z.number(),
  class_distribution_shift: z.number(),
  signal_quality_score: z.number(),
  prediction_entropy: z.number().nullable().optional(),
  status: DriftStatusSchema,
  thresholds: z.record(z.string(), z.number()),
  details: z.record(z.string(), z.any()),
  created_at: z.string(),
});
export type DriftObservation = z.infer<typeof DriftObservationSchema>;

// ============================================================================
// 9. Adaptation Manifest Schema
// ============================================================================

export const AdaptationManifestSchema = z.object({
  manifest_version: z.string().default("ADAPTATION_MANIFEST_V1"),
  adaptation_id: z.string(),
  base_model_id: z.string(),
  candidate_model_id: z.string().nullable().optional(),
  scope: AdaptationScopeSchema,
  subject_id: z.string().nullable().optional(),
  policy: AdaptationPolicySchema,
  data_batch_ids: z.array(z.string()),
  training_fingerprint: z.string(),
  validation_fingerprint: z.string(),
  comparison_summary: CandidateComparisonSchema.nullable().optional(),
  promotion_decision: PromotionDecisionSchema.nullable().optional(),
  software_versions: z.record(z.string(), z.string()),
  created_at: z.string(),
});
export type AdaptationManifest = z.infer<typeof AdaptationManifestSchema>;
