/**
 * NeuroMove — Phase 21 Shared Real EEG / BioAmp Acquisition Contracts
 *
 * Provides strongly typed Zod schemas and TypeScript interfaces for the
 * real EEG/BioAmp acquisition boundary, device ingestion, clock normalization,
 * bounded ring buffering, signal quality control, calibration, and end-to-end
 * neurophysiology pipeline integration.
 */

import { z } from "zod";
import { SafetyDecisionEnum } from "./enums";

// ============================================================================
// Acquisition Source & Lifecycle States
// ============================================================================

export const EegAcquisitionSourceEnum = z.enum([
  "PHYSICAL",
  "SIMULATOR",
  "RECORDED",
]);
export type EegAcquisitionSource = z.infer<typeof EegAcquisitionSourceEnum>;

export const EegAcquisitionStateEnum = z.enum([
  "DISCONNECTED",
  "DISCOVERING",
  "CONNECTING",
  "CONFIGURING",
  "CALIBRATING",
  "STREAMING",
  "PAUSED",
  "DEGRADED",
  "STALE",
  "RECONNECTING",
  "STOPPING",
  "ERROR",
]);
export type EegAcquisitionState = z.infer<typeof EegAcquisitionStateEnum>;

export const ChannelQcStatusEnum = z.enum([
  "HEALTHY",
  "FLATLINE",
  "SATURATION",
  "DROPOUT",
  "NONFINITE",
  "EXCESSIVE_VARIANCE",
  "LOW_VARIANCE",
  "RANGE_VIOLATION",
  "TIMESTAMP_INVALID",
  "CHANNEL_MISSING",
  "CHANNEL_DISABLED",
]);
export type ChannelQcStatus = z.infer<typeof ChannelQcStatusEnum>;

// ============================================================================
// Channel & Device Metadata
// ============================================================================

export const EegChannelDescriptorSchema = z.object({
  channel_id: z.string(),
  name: z.string(),
  canonical_name: z.string(),
  index: z.number().int().nonnegative(),
  enabled: z.boolean().default(true),
  reference: z.string().default("COMMON_AVERAGE"),
  unit: z.string().default("uV"),
  range_uv: z.tuple([z.number(), z.number()]).default([-500, 500]),
  qc_status: ChannelQcStatusEnum.default("HEALTHY"),
  impedance_kohm: z.number().nullable().optional(),
});
export type EegChannelDescriptor = z.infer<typeof EegChannelDescriptorSchema>;

export const EegDeviceDescriptorSchema = z.object({
  device_id: z.string(),
  name: z.string(),
  source_type: EegAcquisitionSourceEnum,
  vendor: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  firmware_version: z.string().nullable().optional(),
  protocol: z.string().default("1.0"),
  channel_count: z.number().int().positive(),
  supported_sampling_rates: z.array(z.number().int().positive()).default([125, 250, 500, 1000]),
  default_sampling_rate: z.number().int().positive().default(250),
  adc_resolution_bits: z.number().int().positive().default(24),
  is_available: z.boolean().default(true),
  is_connected: z.boolean().default(false),
  connection_path: z.string().nullable().optional(),
});
export type EegDeviceDescriptor = z.infer<typeof EegDeviceDescriptorSchema>;

// ============================================================================
// Configuration & Session Metadata
// ============================================================================

export const EegAcquisitionConfigSchema = z.object({
  session_id: z.string(),
  subject_id: z.string().default("sub-01"),
  source_type: EegAcquisitionSourceEnum.default("SIMULATOR"),
  device_id: z.string().default("sim_bioamp_01"),
  sampling_rate: z.number().int().positive().default(250),
  channels: z.array(EegChannelDescriptorSchema),
  chunk_size_samples: z.number().int().positive().default(25),
  buffer_duration_sec: z.number().positive().default(10.0),
  normalization_enabled: z.boolean().default(true),
  qc_enabled: z.boolean().default(true),
  qc_flatline_std_uv: z.number().positive().default(0.1),
  qc_saturation_amp_uv: z.number().positive().default(450.0),
  recording_enabled: z.boolean().default(false),
  seed: z.number().int().nullable().optional(),
});
export type EegAcquisitionConfig = z.infer<typeof EegAcquisitionConfigSchema>;

export const EegClockInfoSchema = z.object({
  host_timestamp: z.string(),
  device_timestamp: z.string().nullable().optional(),
  normalized_timestamp: z.string(),
  clock_offset_ms: z.number().default(0.0),
  clock_drift_ppm: z.number().default(0.0),
  discontinuity_count: z.number().int().nonnegative().default(0),
  monotonicity_verified: z.boolean().default(true),
});
export type EegClockInfo = z.infer<typeof EegClockInfoSchema>;

export const EegSamplePacketSchema = z.object({
  packet_id: z.string(),
  session_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  device_timestamp: z.string().nullable().optional(),
  host_receive_timestamp: z.string(),
  normalized_timestamp: z.string(),
  sample_count: z.number().int().positive(),
  channel_count: z.number().int().positive(),
  channels: z.array(z.string()),
  layout: z.enum(["SAMPLE_MAJOR", "CHANNEL_MAJOR"]).default("CHANNEL_MAJOR"),
  data: z.array(z.array(z.number())),
  quality_flags: z.record(z.string()).default({}),
  checksum: z.string().optional(),
  is_valid: z.boolean().default(true),
});
export type EegSamplePacket = z.infer<typeof EegSamplePacketSchema>;

// ============================================================================
// Channel QC & Health Snapshots
// ============================================================================

export const EegChannelHealthSnapshotSchema = z.object({
  channel_name: z.string(),
  qc_status: ChannelQcStatusEnum,
  mean_amp_uv: z.number(),
  std_amp_uv: z.number(),
  min_amp_uv: z.number(),
  max_amp_uv: z.number(),
  variance: z.number(),
  packet_loss_rate: z.number().min(0.0).max(1.0).default(0.0),
  is_healthy: z.boolean(),
});
export type EegChannelHealthSnapshot = z.infer<typeof EegChannelHealthSnapshotSchema>;

export const EegStreamHealthSnapshotSchema = z.object({
  session_id: z.string(),
  state: EegAcquisitionStateEnum,
  source_type: EegAcquisitionSourceEnum,
  sample_rate: z.number().int().positive(),
  samples_received: z.number().int().nonnegative(),
  samples_dropped: z.number().int().nonnegative(),
  buffer_fill_pct: z.number().min(0.0).max(100.0),
  packet_loss_pct: z.number().min(0.0).max(100.0),
  mean_latency_ms: z.number().nonnegative(),
  clock_drift_ms: z.number().default(0.0),
  degraded_channel_count: z.number().int().nonnegative(),
  is_nominal: z.boolean(),
  timestamp: z.string(),
});
export type EegStreamHealthSnapshot = z.infer<typeof EegStreamHealthSnapshotSchema>;

export const EegCalibrationSnapshotSchema = z.object({
  calibration_id: z.string(),
  session_id: z.string(),
  subject_id: z.string(),
  state: z.enum(["NOT_CALIBRATED", "CALIBRATING", "CALIBRATED", "FAILED"]),
  baseline_duration_sec: z.number().nonnegative(),
  baseline_mean_uv: z.record(z.number()).default({}),
  baseline_std_uv: z.record(z.number()).default({}),
  channel_health: z.record(ChannelQcStatusEnum).default({}),
  manifest_hash: z.string(),
  is_ready: z.boolean(),
  created_at: z.string(),
});
export type EegCalibrationSnapshot = z.infer<typeof EegCalibrationSnapshotSchema>;

export const EegAcquisitionSessionSchema = z.object({
  session_id: z.string(),
  subject_id: z.string(),
  source_type: EegAcquisitionSourceEnum,
  device_id: z.string(),
  state: EegAcquisitionStateEnum,
  sampling_rate: z.number().int().positive(),
  channel_count: z.number().int().positive(),
  channel_names: z.array(z.string()),
  started_at: z.string(),
  stopped_at: z.string().nullable().optional(),
  config_hash: z.string(),
  provenance_hash: z.string(),
});
export type EegAcquisitionSession = z.infer<typeof EegAcquisitionSessionSchema>;

export const EegAcquisitionDiagnosticSchema = z.object({
  diag_id: z.string(),
  session_id: z.string().nullable().optional(),
  category: z.enum(["DEVICE", "STREAM", "CLOCK", "BUFFER", "QC", "CALIBRATION", "PIPELINE"]),
  severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]),
  code: z.string(),
  message: z.string(),
  timestamp: z.string(),
  details: z.record(z.any()).optional(),
});
export type EegAcquisitionDiagnostic = z.infer<typeof EegAcquisitionDiagnosticSchema>;

export const EegRecordingManifestSchema = z.object({
  recording_id: z.string(),
  session_id: z.string(),
  subject_id: z.string(),
  source_type: EegAcquisitionSourceEnum,
  device_id: z.string(),
  total_samples: z.number().int().nonnegative(),
  duration_sec: z.number().nonnegative(),
  sampling_rate: z.number().int().positive(),
  channel_count: z.number().int().positive(),
  channel_names: z.array(z.string()),
  storage_path: z.string(),
  checksum: z.string(),
  created_at: z.string(),
});
export type EegRecordingManifest = z.infer<typeof EegRecordingManifestSchema>;

export const EegReplayStateSchema = z.object({
  fixture_id: z.string(),
  name: z.string(),
  total_samples: z.number().int().nonnegative(),
  current_sample: z.number().int().nonnegative(),
  progress_pct: z.number().min(0.0).max(100.0),
  playback_speed: z.number().positive().default(1.0),
  is_paused: z.boolean().default(false),
  is_looping: z.boolean().default(false),
  fixture_hash: z.string(),
});
export type EegReplayState = z.infer<typeof EegReplayStateSchema>;

// ============================================================================
// Live Neurophysiology Pipeline & E2E Verification
// ============================================================================

export const EegLiveInferenceSummarySchema = z.object({
  inference_id: z.string(),
  timestamp: z.string(),
  predicted_class: z.string(),
  predicted_probability: z.number().min(0.0).max(1.0),
  calibrated_confidence: z.number().min(0.0).max(1.0),
  confidence_policy: z.string(),
  temporal_confirmation_state: z.string(),
  intent_state: z.string(),
  safety_decision: SafetyDecisionEnum,
  will_transmit: z.boolean(),
  transport_status: z.string(),
  lineage_hash: z.string(),
});
export type EegLiveInferenceSummary = z.infer<typeof EegLiveInferenceSummarySchema>;

export const EegE2EExperimentSchema = z.object({
  experiment_id: z.string(),
  scenario_id: z.string(),
  name: z.string(),
  source_type: EegAcquisitionSourceEnum,
  session_id: z.string(),
  subject_id: z.string(),
  passed: z.boolean(),
  verdict: z.string(),
  lineage_chain: z.record(z.string()),
  manifest_hash: z.string(),
  started_at: z.string(),
  completed_at: z.string(),
  details: z.record(z.any()),
});
export type EegE2EExperiment = z.infer<typeof EegE2EExperimentSchema>;

export const EegE2EResultSchema = z.object({
  result_id: z.string(),
  experiment_id: z.string(),
  scenario_id: z.string(),
  stage_results: z.record(z.boolean()),
  predicted_intent: z.string(),
  confidence_score: z.number(),
  safety_decision: SafetyDecisionEnum,
  hil_status: z.string(),
  latency_breakdown_ms: z.record(z.number()),
  passed: z.boolean(),
  failure_reason: z.string().nullable().optional(),
  timestamp: z.string(),
});
export type EegE2EResult = z.infer<typeof EegE2EResultSchema>;
