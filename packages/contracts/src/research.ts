import { z } from "zod";

// ============================================================================
// Phase 22: Deterministic Replay, Research Analytics & Evaluation Contracts
// ============================================================================

export const ResearchExperimentStatusEnum = z.enum([
  "DRAFT",
  "READY",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REPLAYED",
  "REPRODUCIBILITY_FAILED",
]);
export type ResearchExperimentStatus = z.infer<typeof ResearchExperimentStatusEnum>;

export const AnalysisTypeEnum = z.enum([
  "BENCHMARK",
  "ABLATION",
  "ROBUSTNESS",
  "COMPARISON",
  "REPRODUCIBILITY",
  "COUNTERFACTUAL",
]);
export type AnalysisType = z.infer<typeof AnalysisTypeEnum>;

export const ReplayModeEnum = z.enum([
  "STRICT",
  "DETERMINISTIC_ACCELERATED",
  "STEP",
  "COUNTERFACTUAL",
]);
export type ReplayMode = z.infer<typeof ReplayModeEnum>;

export const GroupingStrategyEnum = z.enum([
  "GROUP_BY_SUBJECT",
  "GROUP_BY_SESSION",
]);
export type GroupingStrategy = z.infer<typeof GroupingStrategyEnum>;

export const ReproducibilityStatusEnum = z.enum([
  "PASS",
  "APPROXIMATE",
  "FAIL",
  "NOT_CHECKED",
]);
export type ReproducibilityStatus = z.infer<typeof ReproducibilityStatusEnum>;

export const ArtifactTypeEnum = z.enum([
  "MANIFEST_JSON",
  "RESULT_JSON",
  "METRICS_CSV",
  "LATENCY_CSV",
  "CONFUSION_MATRIX_JSON",
  "REPRODUCIBILITY_REPORT_JSON",
  "MODEL_COMPARISON_JSON",
  "ROBUSTNESS_SWEEP_JSON",
  "EXPERIMENT_SUMMARY_MD",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeEnum>;

export const PipelineStageEnum = z.enum([
  "SOURCE",
  "ACQUISITION",
  "CLOCK",
  "QC",
  "DSP",
  "EPOCH",
  "FEATURES",
  "CSP",
  "MODEL",
  "PERSONALIZATION",
  "ADAPTATION",
  "CONFIDENCE",
  "INTENT",
  "SAFETY",
  "HIL",
]);
export type PipelineStage = z.infer<typeof PipelineStageEnum>;

// ============================================================================
// Manifest & Configuration Schemas
// ============================================================================

export const ExperimentManifestSchema = z.object({
  manifest_id: z.string(),
  experiment_id: z.string(),
  app_version: z.string(),
  git_commit: z.string(),
  source_session_ids: z.array(z.string()),
  source_checksums: z.record(z.string()),
  channel_names: z.array(z.string()),
  sampling_rate: z.number(),
  montage: z.string(),
  clock_config: z.record(z.any()),
  qc_config: z.record(z.any()),
  dsp_config: z.record(z.any()),
  epoch_config: z.record(z.any()),
  feature_config: z.record(z.any()),
  csp_config: z.record(z.any()),
  model_id: z.string(),
  model_version: z.string(),
  personalization_profile: z.record(z.any()),
  adaptation_state: z.record(z.any()),
  confidence_policy: z.record(z.any()),
  intent_policy: z.record(z.any()),
  safety_policy: z.record(z.any()),
  hil_profile: z.record(z.any()),
  seed: z.number(),
  numerical_tolerances: z.record(z.number()),
  analysis_parameters: z.record(z.any()),
  export_version: z.string(),
  is_sealed: z.boolean(),
  manifest_hash: z.string(),
  created_at: z.string(),
  sealed_at: z.string().optional().nullable(),
});
export type ExperimentManifest = z.infer<typeof ExperimentManifestSchema>;

// ============================================================================
// Stage Results & Lineage Schemas
// ============================================================================

export const StageResultSchema = z.object({
  stage: PipelineStageEnum,
  status: z.enum(["PASSED", "WARNING", "FAILED", "SKIPPED"]),
  input_count: z.number(),
  output_count: z.number(),
  rejected_count: z.number(),
  latency_ms: z.number(),
  configuration_hash: z.string(),
  stage_checksum: z.string(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
});
export type StageResult = z.infer<typeof StageResultSchema>;

// ============================================================================
// Scientific Metric Results Schemas
// ============================================================================

export const ConfusionMatrixSchema = z.object({
  classes: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  normalized_matrix: z.array(z.array(z.number())),
  total_samples: z.number(),
});
export type ConfusionMatrix = z.infer<typeof ConfusionMatrixSchema>;

export const MetricResultSchema = z.object({
  experiment_id: z.string(),
  accuracy: z.number().nullable(),
  balanced_accuracy: z.number().nullable(),
  precision_macro: z.number().nullable(),
  recall_macro: z.number().nullable(),
  f1_macro: z.number().nullable(),
  per_class_precision: z.record(z.number().nullable()),
  per_class_recall: z.record(z.number().nullable()),
  per_class_f1: z.record(z.number().nullable()),
  confusion_matrix: ConfusionMatrixSchema.nullable(),
  expected_calibration_error: z.number().nullable(),
  brier_score: z.number().nullable(),
  roc_auc_macro: z.number().nullable(),
  pr_auc_macro: z.number().nullable(),
  total_trials: z.number(),
  evaluated_trials: z.number(),
  rejected_trials: z.number(),
  rejection_rate: z.number(),
  unsupported_metrics: z.array(z.string()).optional(),
  evaluated_at: z.string(),
});
export type MetricResult = z.infer<typeof MetricResultSchema>;

// ============================================================================
// Confidence, Intent, Safety & HIL Analytics Schemas
// ============================================================================

export const ConfidenceAnalyticsSchema = z.object({
  distribution_bins: z.array(z.number()),
  bin_counts: z.array(z.number()),
  mean_confidence: z.number(),
  median_confidence: z.number(),
  low_confidence_rate: z.number(),
  confirmation_rate: z.number(),
  stale_data_rate: z.number(),
  confidence_vs_accuracy_bins: z.array(
    z.object({
      bin_range: z.string(),
      avg_confidence: z.number(),
      accuracy: z.number(),
      sample_count: z.number(),
    })
  ),
});
export type ConfidenceAnalytics = z.infer<typeof ConfidenceAnalyticsSchema>;

export const IntentAnalyticsSchema = z.object({
  candidate_count: z.number(),
  confirmed_count: z.number(),
  active_count: z.number(),
  cancelled_count: z.number(),
  expired_count: z.number(),
  interrupted_count: z.number(),
  candidate_to_confirmed_rate: z.number(),
  confirmed_to_active_rate: z.number(),
  mean_confirmation_latency_ms: z.number(),
});
export type IntentAnalytics = z.infer<typeof IntentAnalyticsSchema>;

export const SafetyAnalyticsSchema = z.object({
  authorized_count: z.number(),
  denied_count: z.number(),
  held_count: z.number(),
  emergency_stop_count: z.number(),
  locked_out_count: z.number(),
  invalid_count: z.number(),
  expired_count: z.number(),
  rule_violations: z.record(z.number()),
  zero_transmission_proof_count: z.number(),
  mean_safety_latency_ms: z.number(),
});
export type SafetyAnalytics = z.infer<typeof SafetyAnalyticsSchema>;

export const HilAnalyticsSchema = z.object({
  candidates: z.number(),
  authorized_dispatches: z.number(),
  transmitted_frames: z.number(),
  ack_count: z.number(),
  nack_count: z.number(),
  retry_count: z.number(),
  crc_failures: z.number(),
  sequence_failures: z.number(),
  disconnects: z.number(),
  mean_roundtrip_latency_ms: z.number(),
});
export type HilAnalytics = z.infer<typeof HilAnalyticsSchema>;

// ============================================================================
// Latency & Signal Quality Analytics Schemas
// ============================================================================

export const LatencyPercentilesSchema = z.object({
  min_ms: z.number(),
  max_ms: z.number(),
  mean_ms: z.number(),
  median_ms: z.number(),
  p50_ms: z.number(),
  p90_ms: z.number(),
  p95_ms: z.number(),
  p99_ms: z.number(),
  sample_count: z.number(),
});
export type LatencyPercentiles = z.infer<typeof LatencyPercentilesSchema>;

export const LatencyAnalyticsSchema = z.object({
  per_stage: z.record(LatencyPercentilesSchema),
  total_pipeline: LatencyPercentilesSchema,
});
export type LatencyAnalytics = z.infer<typeof LatencyAnalyticsSchema>;

export const SignalQualityAnalyticsSchema = z.object({
  healthy_channel_proportion: z.number(),
  flatline_events: z.number(),
  saturation_events: z.number(),
  dropout_events: z.number(),
  packet_loss_pct: z.number(),
  buffer_overflow_events: z.number(),
  timestamp_discontinuities: z.number(),
  per_channel_snr_db: z.record(z.number()),
  session_quality_trend: z.array(
    z.object({
      timestamp: z.string(),
      healthy_channels: z.number(),
      mean_variance: z.number(),
    })
  ),
});
export type SignalQualityAnalytics = z.infer<typeof SignalQualityAnalyticsSchema>;

// ============================================================================
// Ablation & Robustness Schemas
// ============================================================================

export const AblationRunSchema = z.object({
  ablation_id: z.string(),
  parent_experiment_id: z.string(),
  child_experiment_id: z.string(),
  ablation_type: z.enum([
    "CHANNEL_DROPOUT",
    "BANDPASS_FILTER",
    "PERSONALIZATION_TOGGLE",
    "ADAPTATION_TOGGLE",
    "CONFIDENCE_THRESHOLD",
    "CONFIRMATION_PERSISTENCE",
  ]),
  parameter_delta: z.record(z.any()),
  baseline_accuracy: z.number(),
  ablated_accuracy: z.number(),
  accuracy_delta: z.number(),
  baseline_f1: z.number(),
  ablated_f1: z.number(),
  f1_delta: z.number(),
  created_at: z.string(),
});
export type AblationRun = z.infer<typeof AblationRunSchema>;

export const RobustnessRunSchema = z.object({
  robustness_id: z.string(),
  parent_experiment_id: z.string(),
  perturbation_type: z.enum([
    "ADDITIVE_NOISE",
    "AMPLITUDE_SCALING",
    "CHANNEL_DROPOUT",
    "PACKET_LOSS",
    "TIMESTAMP_JITTER",
    "TIMESTAMP_DISCONTINUITY",
    "AMPLITUDE_CLIPPING",
    "VARIANCE_PERTURBATION",
  ]),
  perturbation_level: z.number(),
  seed: z.number(),
  resulting_accuracy: z.number(),
  resulting_f1: z.number(),
  qc_degraded_rate: z.number(),
  rejection_rate: z.number(),
  created_at: z.string(),
});
export type RobustnessRun = z.infer<typeof RobustnessRunSchema>;

// ============================================================================
// Comparison & Statistics Schemas
// ============================================================================

export const ComparisonResultSchema = z.object({
  comparison_id: z.string(),
  comparison_type: z.enum([
    "MODEL_VS_MODEL",
    "SUBJECT_VS_SUBJECT",
    "SESSION_VS_SESSION",
    "GENERIC_VS_PERSONALIZED",
    "PRE_VS_POST_ADAPTATION",
  ]),
  baseline_experiment_id: z.string(),
  candidate_experiment_id: z.string(),
  metric_deltas: z.record(z.number()),
  effect_size: z.number().nullable(),
  p_value: z.number().nullable(),
  confidence_interval: z.tuple([z.number(), z.number()]).nullable(),
  statistical_method: z.string(),
  sample_size: z.number(),
  is_statistically_significant: z.boolean(),
  created_at: z.string(),
});
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

export const StatisticalResultSchema = z.object({
  metric_name: z.string(),
  sample_count: z.number(),
  mean: z.number(),
  median: z.number(),
  std: z.number(),
  variance: z.number(),
  min: z.number(),
  max: z.number(),
  p25: z.number(),
  p75: z.number(),
  ci_lower_95: z.number().nullable(),
  ci_upper_95: z.number().nullable(),
  bootstrap_iterations: z.number().optional(),
});
export type StatisticalResult = z.infer<typeof StatisticalResultSchema>;

// ============================================================================
// Reproducibility & Checkpoints Schemas
// ============================================================================

export const ReproducibilityResultSchema = z.object({
  audit_id: z.string(),
  baseline_experiment_id: z.string(),
  reproduced_experiment_id: z.string(),
  status: ReproducibilityStatusEnum,
  source_hash_match: z.boolean(),
  manifest_hash_match: z.boolean(),
  stage_hashes_match: z.boolean(),
  metrics_match: z.boolean(),
  result_hash_match: z.boolean(),
  max_metric_deviation: z.number(),
  deviations: z.record(z.number()),
  tamper_detected: z.boolean(),
  explanation: z.string(),
  audited_at: z.string(),
});
export type ReproducibilityResult = z.infer<typeof ReproducibilityResultSchema>;

export const ReplayCheckpointSchema = z.object({
  checkpoint_id: z.string(),
  experiment_id: z.string(),
  stage: PipelineStageEnum,
  source_offset: z.number(),
  epoch_index: z.number(),
  manifest_hash: z.string(),
  intermediate_checksum: z.string(),
  model_version: z.string(),
  state_payload: z.record(z.any()),
  created_at: z.string(),
});
export type ReplayCheckpoint = z.infer<typeof ReplayCheckpointSchema>;

// ============================================================================
// Research Artifact & Experiment Schemas
// ============================================================================

export const ResearchArtifactSchema = z.object({
  artifact_id: z.string(),
  experiment_id: z.string(),
  artifact_type: ArtifactTypeEnum,
  checksum: z.string(),
  file_name: z.string(),
  content_json: z.string().optional(),
  generated_time: z.string(),
  generator_version: z.string(),
});
export type ResearchArtifact = z.infer<typeof ResearchArtifactSchema>;

export const ResearchDatasetSchema = z.object({
  dataset_id: z.string(),
  name: z.string(),
  description: z.string(),
  session_ids: z.array(z.string()),
  subjects: z.array(z.string()),
  classes: z.array(z.string()),
  grouping_strategy: GroupingStrategyEnum,
  channel_count: z.number(),
  sampling_rate: z.number(),
  dataset_checksum: z.string(),
  created_at: z.string(),
});
export type ResearchDataset = z.infer<typeof ResearchDatasetSchema>;

export const ResearchExperimentSchema = z.object({
  experiment_id: z.string(),
  title: z.string(),
  description: z.string(),
  analysis_type: AnalysisTypeEnum,
  status: ResearchExperimentStatusEnum,
  replay_mode: ReplayModeEnum,
  parent_experiment_id: z.string().optional().nullable(),
  source_session_ids: z.array(z.string()),
  dataset_id: z.string().optional().nullable(),
  grouping_strategy: GroupingStrategyEnum,
  manifest: ExperimentManifestSchema,
  stages: z.array(StageResultSchema),
  metrics: MetricResultSchema.optional().nullable(),
  confidence_analytics: ConfidenceAnalyticsSchema.optional().nullable(),
  intent_analytics: IntentAnalyticsSchema.optional().nullable(),
  safety_analytics: SafetyAnalyticsSchema.optional().nullable(),
  hil_analytics: HilAnalyticsSchema.optional().nullable(),
  latency_analytics: LatencyAnalyticsSchema.optional().nullable(),
  signal_quality_analytics: SignalQualityAnalyticsSchema.optional().nullable(),
  reproducibility: ReproducibilityResultSchema.optional().nullable(),
  result_hash: z.string().optional().nullable(),
  is_sealed: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional().nullable(),
});
export type ResearchExperiment = z.infer<typeof ResearchExperimentSchema>;
