import { z } from "zod";
import { EEGSourceKindEnum } from "./analysis";

export const DatasetCacheStatusEnum = z.enum([
  "NOT_DOWNLOADED",
  "DOWNLOADING",
  "DOWNLOADED",
  "VERIFYING",
  "VERIFIED",
  "PARTIAL",
  "CORRUPT",
  "MISSING",
]);
export type DatasetCacheStatus = z.infer<typeof DatasetCacheStatusEnum>;

export const EventMappingStatusEnum = z.enum([
  "EXACT",
  "NORMALIZED",
  "AMBIGUOUS",
  "UNMAPPED",
]);
export type EventMappingStatus = z.infer<typeof EventMappingStatusEnum>;

export const DatasetDefinitionSchema = z.object({
  dataset_id: z.string(),
  name: z.string(),
  version: z.string(),
  provider: z.string(),
  source_reference: z.string(),
  official_reference: z.string(),
  license: z.string(),
  description: z.string(),
  modality: z.string(),
  tasks: z.array(z.string()),
  default_loader: z.string(),
  supported: z.boolean().default(true),
  schema_version: z.string().default("EEG_DATASET_INGESTION_V1"),
  cache_status: DatasetCacheStatusEnum.default("NOT_DOWNLOADED"),
  subjects_count: z.number().int().default(0),
  recordings_count: z.number().int().default(0),
  total_size_bytes: z.number().int().default(0),
  created_at: z.string().optional(),
});
export type DatasetDefinition = z.infer<typeof DatasetDefinitionSchema>;

export const DatasetSubjectSchema = z.object({
  dataset_id: z.string(),
  subject_id: z.string(),
  source_subject_id: z.string(),
  recording_count: z.number().int().default(0),
  runs: z.array(z.number().int()).default([]),
  available_tasks: z.array(z.string()).default([]),
});
export type DatasetSubject = z.infer<typeof DatasetSubjectSchema>;

export const DatasetEventSchema = z.object({
  event_id: z.string(),
  recording_id: z.string(),
  source_event_code: z.string(),
  source_label: z.string(),
  neuromove_event_type: z.string(),
  onset_samples: z.number().int(),
  onset_seconds: z.number(),
  duration_seconds: z.number(),
  description: z.string(),
  mapping_status: EventMappingStatusEnum.default("NORMALIZED"),
});
export type DatasetEvent = z.infer<typeof DatasetEventSchema>;

export const DatasetRecordingSchema = z.object({
  recording_id: z.string(),
  dataset_id: z.string(),
  dataset_version: z.string(),
  subject_id: z.string(),
  source_subject_id: z.string(),
  session_id: z.string(),
  run_id: z.string(),
  file_reference: z.string(),
  checksum_sha256: z.string(),
  sample_rate_hz: z.number().int(),
  channel_count: z.number().int(),
  channel_names: z.array(z.string()),
  duration_seconds: z.number(),
  task: z.string(),
  normalized_task_label: z.string(),
  event_count: z.number().int(),
  source_kind: EEGSourceKindEnum.default("RECORDED"),
  ingestion_version: z.string().default("EEG_DATASET_INGESTION_V1"),
  loader_version: z.string().default("MNE-1.12.1"),
  cache_status: DatasetCacheStatusEnum.default("NOT_DOWNLOADED"),
  created_at: z.string(),
  events: z.array(DatasetEventSchema).optional().default([]),
});
export type DatasetRecording = z.infer<typeof DatasetRecordingSchema>;

export const DatasetChecksumRecordSchema = z.object({
  relative_path: z.string(),
  size_bytes: z.number().int(),
  sha256: z.string(),
  verification_status: z.enum(["VERIFIED", "CORRUPT", "MISSING", "PENDING"]),
  retrieved_at: z.string(),
});
export type DatasetChecksumRecord = z.infer<typeof DatasetChecksumRecordSchema>;

export const DatasetManifestSchema = z.object({
  dataset_id: z.string(),
  dataset_version: z.string(),
  ingestion_version: z.string().default("EEG_DATASET_INGESTION_V1"),
  source: z.object({
    provider: z.string(),
    reference: z.string(),
    license: z.string(),
  }),
  retrieved_at: z.string(),
  records_count: z.number().int(),
  checksums: z.array(DatasetChecksumRecordSchema),
  environment: z.object({
    python_version: z.string(),
    mne_version: z.string(),
    neuromove_version: z.string(),
  }),
});
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;

export const IngestionQualityReportSchema = z.object({
  dataset_id: z.string(),
  generated_at: z.string(),
  files_discovered: z.number().int(),
  files_downloaded: z.number().int(),
  files_verified: z.number().int(),
  files_failed: z.number().int(),
  recordings_indexed: z.number().int(),
  recordings_failed: z.number().int(),
  metadata_missing: z.number().int(),
  channel_anomalies: z.number().int(),
  event_anomalies: z.number().int(),
  overall_status: z.enum(["EXCELLENT", "DEGRADED", "FAILED"]),
});
export type IngestionQualityReport = z.infer<typeof IngestionQualityReportSchema>;

export const DatasetDownloadRequestSchema = z.object({
  subject_ids: z.array(z.string()).optional(),
  run_ids: z.array(z.string()).optional(),
  force_recheck: z.boolean().default(false),
});
export type DatasetDownloadRequest = z.infer<typeof DatasetDownloadRequestSchema>;

export const DatasetVerifyRequestSchema = z.object({
  dataset_id: z.string(),
});
export type DatasetVerifyRequest = z.infer<typeof DatasetVerifyRequestSchema>;

export const DatasetSignalResponseSchema = z.object({
  recording_id: z.string(),
  dataset_id: z.string(),
  subject_id: z.string(),
  run_id: z.string(),
  sampling_rate_hz: z.number().int(),
  channels: z.array(z.string()),
  timestamps: z.array(z.number()),
  signals: z.record(z.string(), z.array(z.number())),
  events: z.array(DatasetEventSchema),
  duration_seconds: z.number(),
  total_samples: z.number().int(),
  window_start_sec: z.number(),
  window_duration_sec: z.number(),
});
export type DatasetSignalResponse = z.infer<typeof DatasetSignalResponseSchema>;
