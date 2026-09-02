import { z } from "zod";
import {
  SensorModalityEnum,
  SensorSourceEnum,
  SensorStateEnum,
  SynchronizationStatusEnum,
  ContradictionOutcomeEnum,
  MotionContaminationStateEnum,
  FusionStrategyEnum,
  TrialQualityEnum,
} from "./enums";

// ============================================================================
// Phase 23: Multimodal Sensors, Synchronization & Context Schemas
// ============================================================================

export const SensorDeviceDescriptorSchema = z.object({
  device_id: z.string(),
  name: z.string(),
  modality: SensorModalityEnum,
  source: SensorSourceEnum,
  vendor: z.string().default("NeuroMove Labs"),
  model: z.string().default("Generic"),
  firmware_version: z.string().default("1.0.0"),
  protocol: z.string().default("VIRTUAL_STREAM"),
  channel_count: z.number().int().min(1),
  channel_names: z.array(z.string()),
  supported_sampling_rates: z.array(z.number().int()).default([100, 250, 500]),
  default_sampling_rate: z.number().int().default(250),
  adc_resolution_bits: z.number().int().default(24),
  is_available: z.boolean().default(true),
  is_connected: z.boolean().default(false),
  connection_path: z.string().nullable().optional(),
  serial_hash: z.string().nullable().optional(),
  imu_orientation: z.string().nullable().optional(), // e.g. "NED" or "ENU"
});
export type SensorDeviceDescriptor = z.infer<typeof SensorDeviceDescriptorSchema>;

export const SensorChannelHealthSchema = z.object({
  channel_name: z.string(),
  modality: SensorModalityEnum,
  qc_status: TrialQualityEnum.default("VALID"),
  mean_amplitude: z.number().default(0.0),
  snr_db: z.number().default(20.0),
  flatline_rate: z.number().min(0).max(1).default(0.0),
  saturation_rate: z.number().min(0).max(1).default(0.0),
  dropout_rate: z.number().min(0).max(1).default(0.0),
  is_usable: z.boolean().default(true),
});
export type SensorChannelHealth = z.infer<typeof SensorChannelHealthSchema>;

export const SensorHealthSnapshotSchema = z.object({
  sensor_id: z.string(),
  modality: SensorModalityEnum,
  state: SensorStateEnum.default("DISCONNECTED"),
  buffer_occupancy_pct: z.number().min(0).max(100).default(0.0),
  packet_loss_rate: z.number().min(0).max(1).default(0.0),
  jitter_ms: z.number().default(0.0),
  drift_ppm: z.number().default(0.0),
  channels: z.array(SensorChannelHealthSchema).default([]),
  active_anomalies: z.array(z.string()).default([]),
  last_seen: z.string().default("2026-01-01T00:00:00Z"),
  is_healthy: z.boolean().default(true),
});
export type SensorHealthSnapshot = z.infer<typeof SensorHealthSnapshotSchema>;

export const SensorStreamPacketSchema = z.object({
  sensor_id: z.string(),
  modality: SensorModalityEnum,
  source: SensorSourceEnum,
  session_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  device_timestamp: z.number().nullable().optional(),
  host_receive_timestamp: z.string(),
  normalized_timestamp: z.string(),
  sample_count: z.number().int().min(1),
  channel_count: z.number().int().min(1),
  channel_names: z.array(z.string()),
  data: z.array(z.array(z.number())), // [channels][samples]
  units: z.string().default("uV"),
  quality_flags: z.array(z.string()).default([]),
  checksum: z.string().default(""),
  configuration_hash: z.string().default(""),
});
export type SensorStreamPacket = z.infer<typeof SensorStreamPacketSchema>;

export const MultimodalSyncStateSchema = z.object({
  session_id: z.string(),
  global_session_time_iso: z.string(),
  status: SynchronizationStatusEnum.default("SYNCHRONIZED"),
  primary_clock_sensor_id: z.string(),
  estimated_offsets_ms: z.record(z.string(), z.number()).default({}),
  estimated_drifts_ppm: z.record(z.string(), z.number()).default({}),
  max_jitter_ms: z.number().default(0.0),
  alignment_quality_pct: z.number().min(0).max(100).default(100.0),
  total_discontinuities: z.number().int().default(0),
  is_aligned: z.boolean().default(true),
});
export type MultimodalSyncState = z.infer<typeof MultimodalSyncStateSchema>;

export const SensorCalibrationSnapshotSchema = z.object({
  calibration_id: z.string(),
  sensor_id: z.string(),
  modality: SensorModalityEnum,
  timestamp: z.string(),
  parameters: z.record(z.string(), z.any()).default({}),
  quality_metrics: z.record(z.string(), z.number()).default({}),
  manifest_hash: z.string().default(""),
  is_calibrated: z.boolean().default(true),
  is_ready: z.boolean().default(true),
});
export type SensorCalibrationSnapshot = z.infer<typeof SensorCalibrationSnapshotSchema>;

export const FusionEvidenceSchema = z.object({
  evidence_id: z.string(),
  timestamp: z.string(),
  sensor_id: z.string(),
  modality: SensorModalityEnum,
  feature_name: z.string(),
  feature_value: z.number(),
  confidence: z.number().min(0).max(1),
  interpretation: z.string(),
});
export type FusionEvidence = z.infer<typeof FusionEvidenceSchema>;

export const ContradictionRecordSchema = z.object({
  contradiction_id: z.string(),
  timestamp: z.string(),
  rule_name: z.string(),
  conflicting_sensor_ids: z.array(z.string()),
  conflicting_modalities: z.array(SensorModalityEnum),
  outcome: ContradictionOutcomeEnum.default("HOLD"),
  reason: z.string(),
  severity: z.string().default("MEDIUM"),
});
export type ContradictionRecord = z.infer<typeof ContradictionRecordSchema>;

export const FusionResultSchema = z.object({
  fusion_id: z.string(),
  timestamp: z.string(),
  strategy: FusionStrategyEnum.default("RULE_BASED_CONTEXT"),
  participating_sensor_ids: z.array(z.string()),
  participating_modalities: z.array(SensorModalityEnum),
  evidence: z.array(FusionEvidenceSchema).default([]),
  alignment_quality: z.number().min(0).max(1).default(1.0),
  has_contradiction: z.boolean().default(false),
  contradiction_outcome: ContradictionOutcomeEnum.default("INFORMATIONAL"),
  contradiction_reason: z.string().nullable().optional(),
  fused_context_score: z.number().min(0).max(1).default(1.0),
  context_confidence: z.number().min(0).max(1).default(1.0),
  is_valid: z.boolean().default(true),
});
export type FusionResult = z.infer<typeof FusionResultSchema>;

export const MultimodalContextSchema = z.object({
  context_id: z.string(),
  timestamp: z.string(),
  session_id: z.string(),
  motion_state: z.string().default("STATIONARY"), // "STATIONARY" | "MOVING" | "UNKNOWN"
  motion_contamination_state: MotionContaminationStateEnum.default("MOTION_QUIET"),
  peripheral_activation: z.boolean().default(false),
  ocular_artifact_detected: z.boolean().default(false),
  contact_present: z.boolean().default(true),
  pulse_bpm: z.number().nullable().optional(),
  context_confidence: z.number().min(0).max(1).default(0.95),
  is_movement_valid: z.boolean().default(true),
  is_eeg_contaminated: z.boolean().default(false),
  is_stale: z.boolean().default(false),
  participating_sensors: z.array(z.string()).default([]),
  active_contradictions: z.array(ContradictionRecordSchema).default([]),
});
export type MultimodalContext = z.infer<typeof MultimodalContextSchema>;

export const MultimodalSessionSchema = z.object({
  session_id: z.string(),
  subject_id: z.string().default("SUBJ_ANONYMOUS"),
  start_time: z.string(),
  end_time: z.string().nullable().optional(),
  active_sensors: z.array(z.string()).default([]),
  sync_state: MultimodalSyncStateSchema.optional(),
  global_state: SensorStateEnum.default("STREAMING"),
  calibration_state: z.record(z.string(), z.boolean()).default({}),
  analysis_profile: z.string().default("STANDARD_MI_FUSION"),
  config_hash: z.string().default(""),
});
export type MultimodalSession = z.infer<typeof MultimodalSessionSchema>;

export const MultimodalReplayFixtureSchema = z.object({
  fixture_id: z.string(),
  name: z.string(),
  description: z.string(),
  modalities: z.array(SensorModalityEnum),
  sample_rates: z.record(z.string(), z.number().int()),
  channel_maps: z.record(z.string(), z.array(z.string())),
  duration_sec: z.number(),
  checksum: z.string(),
  privacy_level: z.string().default("PUBLIC_SYNTHETIC"),
  expected_context: z.string().default("REST_AND_IMAGERY"),
});
export type MultimodalReplayFixture = z.infer<typeof MultimodalReplayFixtureSchema>;

export const MultimodalAnalyticsSummarySchema = z.object({
  session_count: z.number().int().default(0),
  sensor_availability_pct: z.number().min(0).max(100).default(100.0),
  sync_coverage_pct: z.number().min(0).max(100).default(100.0),
  modality_dropout_rate: z.number().min(0).max(1).default(0.0),
  fusion_agreement_rate: z.number().min(0).max(1).default(1.0),
  contradiction_rate: z.number().min(0).max(1).default(0.0),
  context_invalidation_rate: z.number().min(0).max(1).default(0.0),
  confidence_delta: z.number().default(0.0),
  intent_confirmation_delta: z.number().default(0.0),
  safety_hold_delta: z.number().default(0.0),
  mean_sync_latency_ms: z.number().default(0.5),
  mean_fusion_latency_ms: z.number().default(0.8),
});
export type MultimodalAnalyticsSummary = z.infer<typeof MultimodalAnalyticsSummarySchema>;
