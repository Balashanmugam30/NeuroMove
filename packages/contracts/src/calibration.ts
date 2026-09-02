import { z } from "zod";
import { NormalizedLabelSchema } from "./epoching";

import {
  ModelFamilySchema,
  FeatureRepresentationSchema,
  SearchConfigSchema,
} from "./experiments";
import { CSPConfigSchema, ConfusionMatrixDataSchema } from "./decoding";


// 1. Core Enumerations
export const SubjectProfileStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export type SubjectProfileStatus = z.infer<typeof SubjectProfileStatusSchema>;

export const CalibrationProfileStateSchema = z.enum([
  "NOT_CALIBRATED",
  "PLANNED",
  "IN_PROGRESS",
  "QUALITY_REVIEW",
  "READY",
  "STALE",
  "INVALID",
  "ARCHIVED",
]);
export type CalibrationProfileState = z.infer<typeof CalibrationProfileStateSchema>;

export const CalibrationSessionStatusSchema = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "PAUSED",
  "QUALITY_REVIEW",
  "READY",
  "ABORTED",
  "INVALID",
  "ARCHIVED",
]);
export type CalibrationSessionStatus = z.infer<typeof CalibrationSessionStatusSchema>;

export const CalibrationTrialStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "COMPLETED",
  "REJECTED",
  "SKIPPED",
  "ABORTED",
]);
export type CalibrationTrialStatus = z.infer<typeof CalibrationTrialStatusSchema>;

export const CalibrationQCStatusSchema = z.enum(["PASS", "WARN", "REJECT"]);
export type CalibrationQCStatus = z.infer<typeof CalibrationQCStatusSchema>;

export const CalibrationRejectionReasonSchema = z.enum([
  "INCOMPLETE_EPOCH",
  "BAD_ANNOTATION",
  "CHANNEL_FAILURE",
  "DROPOUT",
  "NONFINITE_DATA",
  "OUT_OF_BOUNDS",
  "SIGNAL_QUALITY_LOW",
  "MANUAL_REJECT",
]);
export type CalibrationRejectionReason = z.infer<typeof CalibrationRejectionReasonSchema>;

export const CueTypeSchema = z.enum([
  "REST",
  "FIXATION",
  "LEFT",
  "RIGHT",
  "FEET",
  "FISTS",
]);
export type CueType = z.infer<typeof CueTypeSchema>;

export const CalibrationSourceModeSchema = z.enum(["SIMULATION", "REPLAY", "LIVE"]);
export type CalibrationSourceMode = z.infer<typeof CalibrationSourceModeSchema>;

export const PersonalizedModelStatusSchema = z.enum([
  "CALIBRATING",
  "RESEARCH_READY",
  "STALE",
  "INVALID",
  "ARCHIVED",
]);
export type PersonalizedModelStatus = z.infer<typeof PersonalizedModelStatusSchema>;

export const AdaptationStrategySchema = z.enum([
  "TRAIN_FROM_SCRATCH",
  "WARM_START_FINE_TUNE",
]);
export type AdaptationStrategy = z.infer<typeof AdaptationStrategySchema>;

export const HeldOutSplitStrategySchema = z.enum([
  "TEMPORAL_BLOCK_SPLIT",
  "STRATIFIED_SHUFFLE_SPLIT",
]);
export type HeldOutSplitStrategy = z.infer<typeof HeldOutSplitStrategySchema>;

// 2. Subject Profile Schemas
export const SubjectProfileSchema = z.object({
  subject_id: z.string(),
  profile_id: z.string(),
  profile_version: z.string().default("SUBJECT_PROFILE_V1"),
  status: SubjectProfileStatusSchema.default("ACTIVE"),
  preferred_hand: z.enum(["RIGHT", "LEFT", "AMBIDEXTROUS"]).default("RIGHT"),
  display_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SubjectProfile = z.infer<typeof SubjectProfileSchema>;

export const CreateSubjectProfileRequestSchema = z.object({
  subject_id: z.string(),
  preferred_hand: z.enum(["RIGHT", "LEFT", "AMBIDEXTROUS"]).default("RIGHT"),
  display_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateSubjectProfileRequest = z.infer<typeof CreateSubjectProfileRequestSchema>;

// 3. Calibration Profile Schemas
export const CalibrationProfileSchema = z.object({
  profile_id: z.string(),
  subject_id: z.string(),
  profile_version: z.string().default("CALIBRATION_PROFILE_V1"),
  state: CalibrationProfileStateSchema.default("NOT_CALIBRATED"),
  preferred_task: z.string().default("LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"),
  target_classes: z.array(NormalizedLabelSchema).default([
    "LEFT_IMAGERY",
    "RIGHT_IMAGERY",
  ]),
  channel_set: z.array(z.string()).default(["C3", "Cz", "C4"]),
  preprocessing_config: z.record(z.string(), z.any()).default({}),
  epoching_config: z.record(z.string(), z.any()).default({}),
  feature_config: z.record(z.string(), z.any()).default({}),
  decoder_config: z.record(z.string(), z.any()).default({}),
  last_calibration_id: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CalibrationProfile = z.infer<typeof CalibrationProfileSchema>;

// 4. Calibration Protocol Schemas
export const CalibrationProtocolSchema = z.object({
  protocol_id: z.string(),
  protocol_version: z.string().default("CALIBRATION_PROTOCOL_V1"),
  name: z.string(),
  target_classes: z.array(NormalizedLabelSchema),
  trials_per_class: z.number().int().positive().default(10),
  rest_duration_sec: z.number().positive().default(2.0),
  fixation_duration_sec: z.number().positive().default(2.0),
  cue_duration_sec: z.number().positive().default(1.25),
  imagery_duration_sec: z.number().positive().default(4.0),
  iti_min_sec: z.number().positive().default(1.5),
  iti_max_sec: z.number().positive().default(2.5),
  break_policy: z.string().default("EVERY_20_TRIALS"),
  random_state: z.number().int().default(42),
  min_valid_trials_per_class: z.number().int().positive().default(5),
  max_rejection_ratio: z.number().min(0.0).max(1.0).default(0.4),
  qc_rules: z.record(z.string(), z.any()).default({}),
  timing_hash: z.string().optional(),
});
export type CalibrationProtocol = z.infer<typeof CalibrationProtocolSchema>;

// 5. Calibration Trial & Quality Schemas
export const CalibrationTrialSchema = z.object({
  trial_id: z.string(),
  calibration_id: z.string(),
  sequence_index: z.number().int().nonnegative(),
  target_label: NormalizedLabelSchema,
  cue: CueTypeSchema,
  planned_onset: z.number().nonnegative(),
  actual_onset: z.number().nullable().default(null),
  imagery_start: z.number().nullable().default(null),
  imagery_end: z.number().nullable().default(null),
  status: CalibrationTrialStatusSchema.default("PLANNED"),
  quality_status: CalibrationQCStatusSchema.default("PASS"),
  quality_reasons: z.array(CalibrationRejectionReasonSchema).default([]),
  epoch_id: z.string().nullable().default(null),
  notes: z.string().nullable().optional(),
});

export type CalibrationTrial = z.infer<typeof CalibrationTrialSchema>;

export const CalibrationQualitySummarySchema = z.object({
  total_trials: z.number().int().nonnegative(),
  valid_trials: z.number().int().nonnegative(),
  rejected_trials: z.number().int().nonnegative(),
  warn_trials: z.number().int().nonnegative(),
  valid_ratio: z.number().min(0.0).max(1.0),
  rejection_ratio: z.number().min(0.0).max(1.0),
  class_balance: z.record(z.string(), z.number()),
  rejection_breakdown: z.record(z.string(), z.number().int().nonnegative()),
  is_sufficient: z.boolean(),
  sufficiency_warnings: z.array(z.string()),
});
export type CalibrationQualitySummary = z.infer<typeof CalibrationQualitySummarySchema>;

// 6. Calibration Session Schemas
export const CalibrationSessionSchema = z.object({
  calibration_id: z.string(),
  profile_id: z.string(),
  subject_id: z.string(),
  session_number: z.number().int().positive().default(1),
  protocol_version: z.string().default("CALIBRATION_PROTOCOL_V1"),
  task_id: z.string().default("LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"),
  source_mode: CalibrationSourceModeSchema.default("SIMULATION"),
  status: CalibrationSessionStatusSchema.default("PLANNED"),
  started_at: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  trial_count: z.number().int().nonnegative().default(0),
  valid_trial_count: z.number().int().nonnegative().default(0),
  rejected_trial_count: z.number().int().nonnegative().default(0),
  class_distribution: z.record(z.string(), z.number().int().nonnegative()).default({}),
  quality_summary: CalibrationQualitySummarySchema.nullable().default(null),
  pause_intervals: z.array(z.object({ paused_at: z.string(), resumed_at: z.string().nullable() })).default([]),
  active_trial_index: z.number().int().default(0),
  active_phase: z.enum(["IDLE", "REST", "FIXATION", "CUE", "IMAGERY", "BREAK", "COMPLETE"]).default("IDLE"),
  phase_time_remaining_sec: z.number().default(0.0),
  config_hash: z.string(),
  created_at: z.string(),
});
export type CalibrationSession = z.infer<typeof CalibrationSessionSchema>;

export const StartCalibrationSessionRequestSchema = z.object({
  profile_id: z.string(),
  subject_id: z.string(),
  protocol: CalibrationProtocolSchema.optional(),
  source_mode: CalibrationSourceModeSchema.default("SIMULATION"),
  scenario_id: z.string().optional(),
});
export type StartCalibrationSessionRequest = z.infer<typeof StartCalibrationSessionRequestSchema>;

// 7. Personalization & Model Schemas
export const PersonalizationConfigSchema = z.object({
  calibration_id: z.string(),
  profile_id: z.string(),
  subject_id: z.string(),
  task_id: z.string().default("LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"),
  model_family: ModelFamilySchema.default("LDA"),
  representation: FeatureRepresentationSchema.default("CSP_LOG_POWER"),
  csp_config: CSPConfigSchema.default({
    csp_version: "MNE_CSP_V1",
    n_components: 4,
    cov_est: "concat",
    log: true,
    norm_trace: false,
    regularization: null,
    component_order: "mutual_info",
    transform_into: "average_power",
  }),
  adaptation_strategy: AdaptationStrategySchema.default("TRAIN_FROM_SCRATCH"),
  split_strategy: HeldOutSplitStrategySchema.default("TEMPORAL_BLOCK_SPLIT"),
  train_ratio: z.number().min(0.3).max(0.8).default(0.6),
  scale_features: z.boolean().default(false),
  search_config: SearchConfigSchema.default({
    search_type: "NONE",
    n_iter: 10,
    param_grid: {},
    scoring: "balanced_accuracy",
    inner_cv_splits: 3,
  }),
  random_state: z.number().int().default(42),
});
export type PersonalizationConfig = z.infer<typeof PersonalizationConfigSchema>;

export const GenericVsPersonalizedComparisonSchema = z.object({
  generic_model_id: z.string(),
  personalized_model_id: z.string(),
  task_id: z.string(),
  heldout_trial_count: z.number().int().positive(),
  generic_balanced_accuracy: z.number(),
  personalized_balanced_accuracy: z.number(),
  delta_balanced_accuracy: z.number(),
  generic_f1: z.number(),
  personalized_f1: z.number(),
  delta_f1: z.number(),
  chance_level: z.number().default(0.5),
});
export type GenericVsPersonalizedComparison = z.infer<typeof GenericVsPersonalizedComparisonSchema>;

export const PersonalizedExperimentResultSchema = z.object({
  experiment_id: z.string(),
  calibration_id: z.string(),
  profile_id: z.string(),
  subject_id: z.string(),
  model_id: z.string(),
  generic_base_model_id: z.string().nullable().default(null),
  train_trial_count: z.number().int().positive(),
  heldout_trial_count: z.number().int().positive(),
  train_trial_ids: z.array(z.string()),
  heldout_trial_ids: z.array(z.string()),
  train_metrics: z.object({
    accuracy: z.number(),
    balanced_accuracy: z.number(),
    f1: z.number(),
  }),
  heldout_metrics: z.object({
    accuracy: z.number(),
    balanced_accuracy: z.number(),
    f1: z.number(),
    precision: z.number(),
    recall: z.number(),
    chance_level: z.number().default(0.5),
    confusion_matrix: ConfusionMatrixDataSchema,
  }),
  comparison_with_generic: GenericVsPersonalizedComparisonSchema.nullable().default(null),
  config: PersonalizationConfigSchema,
  created_at: z.string(),
});
export type PersonalizedExperimentResult = z.infer<typeof PersonalizedExperimentResultSchema>;

export const PersonalizedModelSchema = z.object({
  model_id: z.string(),
  calibration_id: z.string(),
  profile_id: z.string(),
  subject_id: z.string(),
  experiment_id: z.string(),
  generic_base_model_id: z.string().nullable().default(null),
  model_family: ModelFamilySchema,
  representation: FeatureRepresentationSchema,
  status: PersonalizedModelStatusSchema.default("RESEARCH_READY"),
  is_stale: z.boolean().default(false),
  staleness_reasons: z.array(z.string()).default([]),
  heldout_balanced_accuracy: z.number(),
  heldout_f1: z.number(),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  model_card_json: z.record(z.string(), z.any()).default({}),
  created_at: z.string(),
});
export type PersonalizedModel = z.infer<typeof PersonalizedModelSchema>;

// 8. Calibration Report & History Schemas
export const CalibrationReportSchema = z.object({
  report_id: z.string(),
  calibration_id: z.string(),
  subject_id: z.string(),
  profile_id: z.string(),
  protocol_summary: z.record(z.string(), z.any()),
  source_mode: CalibrationSourceModeSchema,
  quality_summary: CalibrationQualitySummarySchema,
  split_summary: z.object({
    train_trials: z.number().int().nonnegative(),
    heldout_trials: z.number().int().nonnegative(),
    strategy: HeldOutSplitStrategySchema,
  }),
  personalized_model_summary: z.object({
    model_id: z.string(),
    model_family: ModelFamilySchema,
    heldout_balanced_accuracy: z.number(),
    heldout_f1: z.number(),
    artifact_checksum_sha256: z.string(),
  }).nullable().default(null),
  generic_comparison: GenericVsPersonalizedComparisonSchema.nullable().default(null),
  known_limitations: z.array(z.string()),
  provenance_chain: z.record(z.string(), z.any()),
  created_at: z.string(),
});
export type CalibrationReport = z.infer<typeof CalibrationReportSchema>;

export const CalibrationHistoryItemSchema = z.object({
  calibration_id: z.string(),
  session_number: z.number().int().positive(),
  protocol_version: z.string(),
  source_mode: CalibrationSourceModeSchema,
  status: CalibrationSessionStatusSchema,
  trial_count: z.number().int().nonnegative(),
  valid_trial_count: z.number().int().nonnegative(),
  model_id: z.string().nullable().default(null),
  heldout_balanced_accuracy: z.number().nullable().default(null),
  created_at: z.string(),
});
export type CalibrationHistoryItem = z.infer<typeof CalibrationHistoryItemSchema>;

export const CalibrationManifestSchema = z.object({
  manifest_version: z.string().default("CALIBRATION_MANIFEST_V1"),
  calibration_id: z.string(),
  subject_id: z.string(),
  profile_id: z.string(),
  protocol_id: z.string(),
  random_state: z.number().int(),
  trial_count: z.number().int(),
  valid_trial_count: z.number().int(),
  rejected_trial_count: z.number().int(),
  trial_sequence_hashes: z.array(z.string()),
  epoch_set_id: z.string().nullable(),
  feature_set_id: z.string().nullable(),
  experiment_id: z.string().nullable(),
  model_id: z.string().nullable(),
  model_artifact_checksum_sha256: z.string().nullable(),
  software_versions: z.record(z.string(), z.string()),
  created_at: z.string(),
});
export type CalibrationManifest = z.infer<typeof CalibrationManifestSchema>;
