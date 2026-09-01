import { z } from "zod";
import { EEGSourceKindEnum } from "./analysis";

// Canonical Preprocessing Enums
export const ReferenceTypeEnum = z.enum(["average", "none", "channel"]);
export type ReferenceType = z.infer<typeof ReferenceTypeEnum>;

export const ArtifactMethodEnum = z.enum(["NONE", "ICA"]);
export type ArtifactMethod = z.infer<typeof ArtifactMethodEnum>;

export const PreprocessingStageEnum = z.enum([
  "VALIDATE",
  "REFERENCE",
  "FILTER",
  "NOTCH",
  "RESAMPLE",
  "ARTIFACT",
  "FINAL_VALIDATE",
]);
export type PreprocessingStage = z.infer<typeof PreprocessingStageEnum>;

export const StageStatusEnum = z.enum(["COMPLETED", "SKIPPED", "FAILED"]);
export type StageStatus = z.infer<typeof StageStatusEnum>;

// Modular Stage Configuration Schemas
export const NotchConfigSchema = z.object({
  enabled: z.boolean().default(false),
  frequencies_hz: z.array(z.number()).default([50.0]),
  notch_width_hz: z.number().default(2.0),
});
export type NotchConfig = z.infer<typeof NotchConfigSchema>;

export const ResampleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  target_hz: z.number().nullable().default(null),
  anti_aliasing: z.boolean().default(true),
});
export type ResampleConfig = z.infer<typeof ResampleConfigSchema>;

export const ICAFitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  n_components: z.number().int().min(2).max(64).default(15),
  method: z.string().default("fastica"),
  random_state: z.number().int().default(42),
  fit_channels: z.array(z.string()).default([]),
  excluded_components: z.array(z.number().int()).default([]),
});
export type ICAFitConfig = z.infer<typeof ICAFitConfigSchema>;

export const PreprocessingConfigSchema = z.object({
  pipeline_version: z.string().default("EEG_PREPROCESSING_V1"),
  reference_type: ReferenceTypeEnum.default("average"),
  reference_channels: z.array(z.string()).default([]),
  highpass_hz: z.number().min(0.1).max(20.0).default(0.5),
  lowpass_hz: z.number().min(5.0).max(120.0).default(40.0),
  notch: NotchConfigSchema.default({
    enabled: false,
    frequencies_hz: [50.0],
    notch_width_hz: 2.0,
  }),
  resample: ResampleConfigSchema.default({
    enabled: false,
    target_hz: null,
    anti_aliasing: true,
  }),
  bad_channels: z.array(z.string()).default([]),
  artifact_method: ArtifactMethodEnum.default("NONE"),
  ica_config: ICAFitConfigSchema.default({
    enabled: false,
    n_components: 15,
    method: "fastica",
    random_state: 42,
    fit_channels: [],
    excluded_components: [],
  }),
});
export type PreprocessingConfig = z.infer<typeof PreprocessingConfigSchema>;

// Preprocessing Request & Job Contracts
export const PreprocessingRequestSchema = z.object({
  source_kind: EEGSourceKindEnum.default("SYNTHETIC"),
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  scenario_id: z.string().nullable().optional(),
  parent_result_id: z.string().nullable().optional(),
  config: PreprocessingConfigSchema.default({
    pipeline_version: "EEG_PREPROCESSING_V1",
    reference_type: "average",
    reference_channels: [],
    highpass_hz: 0.5,
    lowpass_hz: 40.0,
    notch: { enabled: false, frequencies_hz: [50.0], notch_width_hz: 2.0 },
    resample: { enabled: false, target_hz: null, anti_aliasing: true },
    bad_channels: [],
    artifact_method: "NONE",
    ica_config: {
      enabled: false,
      n_components: 15,
      method: "fastica",
      random_state: 42,
      fit_channels: [],
      excluded_components: [],
    },
  }),
});
export type PreprocessingRequest = z.infer<typeof PreprocessingRequestSchema>;

export const PreprocessingStageAuditSchema = z.object({
  stage: PreprocessingStageEnum,
  status: StageStatusEnum,
  started_at: z.string(),
  completed_at: z.string(),
  duration_ms: z.number(),
  parameters: z.record(z.string(), z.any()),
  warnings: z.array(z.string()).default([]),
});
export type PreprocessingStageAudit = z.infer<typeof PreprocessingStageAuditSchema>;

export const SignalIntegrityReportSchema = z.object({
  sample_count: z.number().int(),
  channel_count: z.number().int(),
  nan_count: z.number().int(),
  inf_count: z.number().int(),
  min_amplitude_uv: z.number(),
  max_amplitude_uv: z.number(),
  flatline_channels: z.array(z.string()).default([]),
  amplitude_outlier_candidates: z.number().int().default(0),
  status: z.string().default("HEALTHY"),
});
export type SignalIntegrityReport = z.infer<typeof SignalIntegrityReportSchema>;

export const PreprocessingResultSchema = z.object({
  result_id: z.string().startsWith("pre_"),
  pipeline_version: z.string().default("EEG_PREPROCESSING_V1"),
  config_hash: z.string(),
  source_kind: EEGSourceKindEnum,
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  scenario_id: z.string().nullable().optional(),
  parent_result_id: z.string().nullable().optional(),
  input_sample_rate_hz: z.number(),
  output_sample_rate_hz: z.number(),
  input_channels: z.array(z.string()),
  output_channels: z.array(z.string()),
  duration_seconds: z.number(),
  event_count: z.number().int().default(0),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  integrity_report: SignalIntegrityReportSchema,
  stage_audit: z.array(PreprocessingStageAuditSchema),
  warnings: z.array(z.string()).default([]),
  software_versions: z.record(z.string(), z.string()).default({}),
  created_at: z.string(),
});
export type PreprocessingResult = z.infer<typeof PreprocessingResultSchema>;

export const PreprocessingPreviewSchema = z.object({
  valid: z.boolean(),
  effective_config: PreprocessingConfigSchema,
  input_sample_rate_hz: z.number(),
  estimated_output_sample_rate_hz: z.number(),
  input_channels: z.array(z.string()),
  estimated_output_channels: z.array(z.string()),
  stage_plan: z.array(z.string()),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
});
export type PreprocessingPreview = z.infer<typeof PreprocessingPreviewSchema>;

export const PreprocessingManifestSchema = z.object({
  manifest_version: z.string().default("EEG_PREPROCESSING_V1"),
  result_id: z.string(),
  pipeline_version: z.string(),
  config: PreprocessingConfigSchema,
  source: z.record(z.string(), z.any()),
  input_summary: z.record(z.string(), z.any()),
  output_summary: z.record(z.string(), z.any()),
  stage_audit: z.array(PreprocessingStageAuditSchema),
  integrity_report: SignalIntegrityReportSchema,
  software_versions: z.record(z.string(), z.string()),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
});
export type PreprocessingManifest = z.infer<typeof PreprocessingManifestSchema>;

export const PreprocessingSignalResponseSchema = z.object({
  result_id: z.string(),
  sampling_rate_hz: z.number(),
  channels: z.array(z.string()),
  timestamps: z.array(z.number()),
  signals: z.record(z.string(), z.array(z.number())),
  events: z.array(z.any()).default([]),
});
export type PreprocessingSignalResponse = z.infer<typeof PreprocessingSignalResponseSchema>;
