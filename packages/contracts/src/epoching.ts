import { z } from "zod";
import { EEGSourceKindEnum } from "./analysis";

export const EpochEventMappingStatusSchema = z.enum([
  "MAPPED",
  "UNMAPPED",
  "AMBIGUOUS",
  "INVALID",
]);
export type EpochEventMappingStatus = z.infer<typeof EpochEventMappingStatusSchema>;


export const NormalizedLabelSchema = z.enum([
  "REST",
  "LEFT_IMAGERY",
  "RIGHT_IMAGERY",
  "FEET_IMAGERY",
  "TONGUE_IMAGERY",
  "BOTH_FISTS_IMAGERY",
  "UNKNOWN",
]);
export type NormalizedLabel = z.infer<typeof NormalizedLabelSchema>;

export const EventMappingRuleSchema = z.object({
  source_code: z.string(),
  normalized_label: NormalizedLabelSchema,
  description: z.string().optional(),
});
export type EventMappingRule = z.infer<typeof EventMappingRuleSchema>;

export const EventMappingConfigSchema = z.object({
  mapping_version: z.string().default("EVENT_MAPPING_V1"),
  dataset_id: z.string().optional(),
  rules: z.array(EventMappingRuleSchema),
  default_label: NormalizedLabelSchema.default("UNKNOWN"),
});
export type EventMappingConfig = z.infer<typeof EventMappingConfigSchema>;

export const NormalizedEventSchema = z.object({
  event_id: z.string(),
  source_event_code: z.string(),
  source_label: z.string(),
  normalized_label: NormalizedLabelSchema,
  source_sample: z.number(),
  source_onset_seconds: z.number(),
  processed_sample: z.number(),
  processed_onset_seconds: z.number(),
  duration_seconds: z.number().default(0.0),
  session_id: z.string().optional(),
  recording_id: z.string().optional(),
  mapping_status: EpochEventMappingStatusSchema,
});
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

export const TrialDefinitionSchema = z.object({
  trial_id: z.string(),
  session_id: z.string().optional(),
  recording_id: z.string().optional(),
  event_id: z.string(),
  subject_id: z.string().optional(),
  dataset_id: z.string().optional(),
  label: NormalizedLabelSchema,
  cue_onset_seconds: z.number(),
  analysis_onset_seconds: z.number(),
  window_start_seconds: z.number(),
  window_end_seconds: z.number(),
  baseline_start_seconds: z.number().nullable().optional(),
  baseline_end_seconds: z.number().nullable().optional(),
  status: z.enum(["ACTIVE", "INVALID", "COMPLETED"]).default("ACTIVE"),
});
export type TrialDefinition = z.infer<typeof TrialDefinitionSchema>;

export const EpochQCStatusSchema = z.enum([
  "VALID",
  "REJECTED",
  "INCOMPLETE",
  "BOUNDARY_ERROR",
  "ARTIFACT_FLAGGED",
  "UNKNOWN",
]);
export type EpochQCStatus = z.infer<typeof EpochQCStatusSchema>;

export const EpochingConfigSchema = z.object({
  epoching_version: z.string().default("EEG_EPOCHING_V1"),
  tmin: z.number().default(-1.0),
  tmax: z.number().default(4.0),
  baseline: z.tuple([z.number(), z.number()]).nullable().default([-1.0, 0.0]),
  baseline_mode: z.enum(["APPLIED", "NOT_APPLIED"]).default("APPLIED"),
  analysis_window: z.tuple([z.number(), z.number()]).default([0.5, 4.0]),
  reject_by_annotation: z.boolean().default(true),
  amplitude_rejection_uv: z.number().nullable().default(null),
});
export type EpochingConfig = z.infer<typeof EpochingConfigSchema>;

export const EpochRecordSchema = z.object({
  epoch_id: z.string(),
  epoch_set_id: z.string(),
  trial_id: z.string(),
  event_id: z.string(),
  subject_id: z.string(),
  session_id: z.string().optional(),
  run_id: z.string().optional(),
  label: NormalizedLabelSchema,
  onset_seconds: z.number(),
  qc_status: EpochQCStatusSchema,
  rejection_reason: z.string().nullable().optional(),
  created_at: z.string(),
});
export type EpochRecord = z.infer<typeof EpochRecordSchema>;

export const EpochSummarySchema = z.object({
  epoch_set_id: z.string(),
  epoching_version: z.string(),
  config_hash: z.string(),
  source_kind: EEGSourceKindEnum,
  dataset_id: z.string().optional(),
  recording_id: z.string().optional(),
  preprocessing_result_id: z.string().optional(),
  subject_id: z.string().optional(),
  session_id: z.string().optional(),
  run_id: z.string().optional(),
  sampling_rate_hz: z.number(),
  channel_names: z.array(z.string()),
  tmin: z.number(),
  tmax: z.number(),
  total_events: z.number(),
  mapped_events: z.number(),
  valid_epochs: z.number(),
  rejected_epochs: z.number(),
  rejection_counts: z.record(z.string(), z.number()).default({}),
  label_distribution: z.record(z.string(), z.number()).default({}),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
});
export type EpochSummary = z.infer<typeof EpochSummarySchema>;

export const EpochingPreviewSchema = z.object({
  valid: z.boolean(),
  events_discovered: z.number(),
  mapped_events: z.number(),
  unmapped_events: z.number(),
  invalid_events: z.number(),
  expected_epochs: z.number(),
  sampling_rate_hz: z.number(),
  tmin: z.number(),
  tmax: z.number(),
  baseline: z.tuple([z.number(), z.number()]).nullable(),
  analysis_window: z.tuple([z.number(), z.number()]),
  labels_found: z.array(z.string()),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type EpochingPreview = z.infer<typeof EpochingPreviewSchema>;

export const EpochingRequestSchema = z.object({
  source_kind: EEGSourceKindEnum,
  dataset_id: z.string().optional(),
  recording_id: z.string().optional(),
  scenario_id: z.string().optional(),
  preprocessing_result_id: z.string().optional(),
  mapping_config: EventMappingConfigSchema.optional(),
  epoch_config: EpochingConfigSchema.default({
    epoching_version: "EEG_EPOCHING_V1",
    tmin: -1.0,
    tmax: 4.0,
    baseline: [-1.0, 0.0],
    baseline_mode: "APPLIED",
    analysis_window: [0.5, 4.0],
    reject_by_annotation: true,
    amplitude_rejection_uv: null,
  }),
});
export type EpochingRequest = z.infer<typeof EpochingRequestSchema>;

export const EpochSignalResponseSchema = z.object({
  epoch_id: z.string(),
  trial_id: z.string(),
  label: NormalizedLabelSchema,
  sampling_rate_hz: z.number(),
  channels: z.array(z.string()),
  time_points: z.array(z.number()),
  signals: z.record(z.string(), z.array(z.number())),
  cue_onset_relative_seconds: z.number().default(0.0),
  baseline_window: z.tuple([z.number(), z.number()]).nullable(),
  analysis_window: z.tuple([z.number(), z.number()]),
  qc_status: EpochQCStatusSchema,
});
export type EpochSignalResponse = z.infer<typeof EpochSignalResponseSchema>;

export const EpochManifestSchema = z.object({
  epoch_set_id: z.string(),
  epoching_version: z.string(),
  config_hash: z.string(),
  source_kind: EEGSourceKindEnum,
  dataset_id: z.string().optional(),
  recording_id: z.string().optional(),
  preprocessing_result_id: z.string().optional(),
  subject_id: z.string().optional(),
  session_id: z.string().optional(),
  run_id: z.string().optional(),
  mapping_config: EventMappingConfigSchema,
  epoch_config: EpochingConfigSchema,
  sampling_rate_hz: z.number(),
  channels: z.array(z.string()),
  tmin: z.number(),
  tmax: z.number(),
  total_events: z.number(),
  valid_epochs: z.number(),
  rejected_epochs: z.number(),
  rejection_counts: z.record(z.string(), z.number()),
  label_distribution: z.record(z.string(), z.number()),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
  software_versions: z.record(z.string(), z.string()),
});
export type EpochManifest = z.infer<typeof EpochManifestSchema>;
