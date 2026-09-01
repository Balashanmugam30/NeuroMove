import { z } from "zod";
import { OperatingModeEnum } from "./enums";

export const EEGSourceKindEnum = z.enum(["SYNTHETIC", "RECORDED", "HARDWARE"]);
export type EEGSourceKind = z.infer<typeof EEGSourceKindEnum>;

export const PSDMethodEnum = z.enum(["welch", "multitaper"]);
export type PSDMethod = z.infer<typeof PSDMethodEnum>;

export const AnalysisStatusEnum = z.enum([
  "NOT_STARTED",
  "RUNNING",
  "READY",
  "FAILED",
  "STALE",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;

export const EEGAnalysisMetadataSchema = z.object({
  analysis_id: z.string().startsWith("anl_"),
  analysis_version: z.string().default("EEG_ANALYSIS_V1"),
  session_id: z.string().nullable().optional(),
  trial_id: z.string().nullable().optional(),
  source_kind: EEGSourceKindEnum.default("SYNTHETIC"),
  mode: OperatingModeEnum.default("SIMULATION"),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  sampling_rate_hz: z.number().int().default(250),
  method: z.string().default("welch"),
  frequency_range_hz: z.tuple([z.number(), z.number()]).default([1.0, 40.0]),
  window_seconds: z.tuple([z.number(), z.number()]).default([0.0, 4.0]),
  engine: z.string().default("MNE-Python 1.12.1"),
  created_at: z.string().datetime(),
});
export type EEGAnalysisMetadata = z.infer<typeof EEGAnalysisMetadataSchema>;

export const PSDRequestSchema = z.object({
  session_id: z.string().nullable().optional(),
  trial_id: z.string().nullable().optional(),
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  method: PSDMethodEnum.default("welch"),
  fmin: z.number().min(0.5).max(120.0).default(1.0),
  fmax: z.number().min(1.0).max(125.0).default(40.0),
  window_duration_seconds: z.number().min(1.0).max(16.0).default(4.0),
});
export type PSDRequest = z.infer<typeof PSDRequestSchema>;

export const PSDResponseSchema = z.object({
  frequencies: z.array(z.number()),
  psd_by_channel: z.record(z.string(), z.array(z.number())),
  units: z.string().default("uV^2/Hz"),
  peak_frequencies: z.record(z.string(), z.number()).default({}),
  metadata: EEGAnalysisMetadataSchema,
});
export type PSDResponse = z.infer<typeof PSDResponseSchema>;

export const BandPowerItemSchema = z.object({
  band: z.string(),
  frequency_range: z.tuple([z.number(), z.number()]),
  absolute_power: z.number(),
  relative_power: z.number(),
});
export type BandPowerItem = z.infer<typeof BandPowerItemSchema>;

export const BandPowerRequestSchema = z.object({
  session_id: z.string().nullable().optional(),
  trial_id: z.string().nullable().optional(),
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  method: PSDMethodEnum.default("welch"),
  window_duration_seconds: z.number().min(1.0).max(16.0).default(4.0),
});
export type BandPowerRequest = z.infer<typeof BandPowerRequestSchema>;

export const BandPowerResponseSchema = z.object({
  bands_by_channel: z.record(z.string(), z.record(z.string(), BandPowerItemSchema)),
  mu_erd_lateralization_index: z.number().default(0.0),
  units: z.string().default("uV^2"),
  metadata: EEGAnalysisMetadataSchema,
});
export type BandPowerResponse = z.infer<typeof BandPowerResponseSchema>;

export const TFRRequestSchema = z.object({
  session_id: z.string().nullable().optional(),
  trial_id: z.string().nullable().optional(),
  dataset_id: z.string().nullable().optional(),
  recording_id: z.string().nullable().optional(),
  channel: z.string().default("C3"),
  fmin: z.number().min(1.0).max(60.0).default(4.0),
  fmax: z.number().min(5.0).max(100.0).default(40.0),
  window_duration_seconds: z.number().min(1.0).max(10.0).default(4.0),
});
export type TFRRequest = z.infer<typeof TFRRequestSchema>;

export const TFRResponseSchema = z.object({
  times: z.array(z.number()),
  frequencies: z.array(z.number()),
  power_matrix: z.array(z.array(z.number())),
  channel: z.string().default("C3"),
  units: z.string().default("uV^2"),
  metadata: EEGAnalysisMetadataSchema,
});
export type TFRResponse = z.infer<typeof TFRResponseSchema>;

export const EEGChannelSummarySchema = z.object({
  channel: z.string(),
  label: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  cortical_area: z.string(),
  quality_score: z.number().min(0).max(1).default(0.95),
  snr_db: z.number().default(18.0),
  status: z.string().default("NOMINAL"),
});
export type EEGChannelSummary = z.infer<typeof EEGChannelSummarySchema>;
