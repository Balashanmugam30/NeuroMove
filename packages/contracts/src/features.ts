import { z } from "zod";
import { NormalizedLabelSchema } from "./epoching";

export const FeaturePowerTypeSchema = z.enum([
  "ABSOLUTE",
  "RELATIVE",
  "LOG",
  "ALL",
]);
export type FeaturePowerType = z.infer<typeof FeaturePowerTypeSchema>;

export const CovarianceMethodSchema = z.enum([
  "NORMALIZED",
  "EMPIRICAL",
  "SHRINKAGE",
]);
export type CovarianceMethod = z.infer<typeof CovarianceMethodSchema>;

export const FeatureBandSchema = z.object({
  name: z.string(),
  fmin_hz: z.number(),
  fmax_hz: z.number(),
});
export type FeatureBand = z.infer<typeof FeatureBandSchema>;

export const FeatureConfigSchema = z.object({
  feature_version: z.string().default("EEG_FEATURES_V1"),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  bands: z.array(FeatureBandSchema).default([
    { name: "mu", fmin_hz: 8.0, fmax_hz: 13.0 },
    { name: "beta", fmin_hz: 13.0, fmax_hz: 30.0 },
  ]),
  power_type: FeaturePowerTypeSchema.default("ALL"),
  include_lateralization: z.boolean().default(true),
  lateralization_pairs: z.array(z.tuple([z.string(), z.string()])).default([["C3", "C4"]]),
  epsilon: z.number().default(1e-12),
  covariance_method: CovarianceMethodSchema.default("NORMALIZED"),
});
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

export const FeatureVectorSchema = z.object({
  epoch_id: z.string(),
  trial_id: z.string(),
  subject_id: z.string(),
  session_id: z.string().optional(),
  run_id: z.string().optional(),
  recording_id: z.string().optional(),
  label: NormalizedLabelSchema,
  values: z.record(z.string(), z.number()),
});
export type FeatureVector = z.infer<typeof FeatureVectorSchema>;

export const CovarianceMatrixRecordSchema = z.object({
  epoch_id: z.string(),
  label: NormalizedLabelSchema,
  channels: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  trace: z.number(),
  is_symmetric: z.boolean(),
  is_positive_semi_definite: z.boolean(),
});
export type CovarianceMatrixRecord = z.infer<typeof CovarianceMatrixRecordSchema>;

export const CovarianceSetSchema = z.object({
  covariance_set_id: z.string(),
  epoch_set_id: z.string(),
  channels: z.array(z.string()),
  shape: z.tuple([z.number(), z.number(), z.number()]),
  regularization: CovarianceMethodSchema,
  matrices: z.array(CovarianceMatrixRecordSchema),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
});
export type CovarianceSet = z.infer<typeof CovarianceSetSchema>;

export const FeatureSetSchema = z.object({
  feature_set_id: z.string(),
  feature_version: z.string(),
  config_hash: z.string(),
  source_epoch_set_id: z.string(),
  subject_ids: z.array(z.string()),
  session_ids: z.array(z.string()),
  run_ids: z.array(z.string()),
  trial_ids: z.array(z.string()),
  labels: z.array(NormalizedLabelSchema),
  feature_names: z.array(z.string()),
  row_count: z.number(),
  feature_count: z.number(),
  label_distribution: z.record(z.string(), z.number()),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
  software_versions: z.record(z.string(), z.string()),
});
export type FeatureSet = z.infer<typeof FeatureSetSchema>;

export const FeaturePreviewSchema = z.object({
  valid: z.boolean(),
  epoch_count: z.number(),
  channels: z.array(z.string()),
  bands: z.array(FeatureBandSchema),
  feature_names: z.array(z.string()),
  expected_matrix_shape: z.tuple([z.number(), z.number()]),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type FeaturePreview = z.infer<typeof FeaturePreviewSchema>;

export const FeatureExtractionRequestSchema = z.object({
  epoch_set_id: z.string(),
  config: FeatureConfigSchema.default({
    feature_version: "EEG_FEATURES_V1",
    channels: ["C3", "Cz", "C4"],
    bands: [
      { name: "mu", fmin_hz: 8.0, fmax_hz: 13.0 },
      { name: "beta", fmin_hz: 13.0, fmax_hz: 30.0 },
    ],
    power_type: "ALL",
    include_lateralization: true,
    lateralization_pairs: [["C3", "C4"]],
    epsilon: 1e-12,
    covariance_method: "NORMALIZED",
  }),
});
export type FeatureExtractionRequest = z.infer<typeof FeatureExtractionRequestSchema>;

export const FeatureManifestSchema = z.object({
  feature_set_id: z.string(),
  feature_version: z.string(),
  config_hash: z.string(),
  source_epoch_set_id: z.string(),
  source_dataset_id: z.string().optional(),
  subject_ids: z.array(z.string()),
  session_ids: z.array(z.string()),
  run_ids: z.array(z.string()),
  recording_ids: z.array(z.string()),
  preprocessing_result_ids: z.array(z.string()),
  feature_config: FeatureConfigSchema,
  feature_names: z.array(z.string()),
  feature_count: z.number(),
  row_count: z.number(),
  label_distribution: z.record(z.string(), z.number()),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
  software_versions: z.record(z.string(), z.string()),
});
export type FeatureManifest = z.infer<typeof FeatureManifestSchema>;
