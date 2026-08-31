import { z } from "zod";
import {
  ComponentStatusEnum,
  ConnectionStateEnum,
  IntentEnum,
  OperatingModeEnum,
  RiskLevelEnum,
  RuntimeStateEnum,
  SafetyDecisionEnum,
} from "./enums";

export const ComponentHealthSchema = z.object({
  api: ComponentStatusEnum.default("healthy"),
  database: ComponentStatusEnum.default("not_initialized"),
  eeg: ComponentStatusEnum.default("not_connected"),
  robot: ComponentStatusEnum.default("not_connected"),
  safety: ComponentStatusEnum.default("ready"),
});
export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;

export const SystemStatusSchema = z.object({
  service: z.string().default("neuromove-core"),
  status: z.string().default("ok"),
  version: z.string().default("0.1.0"),
  mode: OperatingModeEnum.default("SIMULATION"),
  timestamp: z.string().datetime(),
  components: ComponentHealthSchema,
});
export type SystemStatus = z.infer<typeof SystemStatusSchema>;

export const SignalQualitySchema = z.object({
  overall_score: z.number().min(0).max(1).default(0),
  c3_impedance_kohm: z.number().min(0).default(0),
  c4_impedance_kohm: z.number().min(0).default(0),
  cz_impedance_kohm: z.number().min(0).default(0),
  is_acceptable: z.boolean().default(false),
});
export type SignalQuality = z.infer<typeof SignalQualitySchema>;

export const SafetyStateSchema = z.object({
  runtime_state: RuntimeStateEnum.default("IDLE"),
  last_decision: SafetyDecisionEnum.default("STOP"),
  risk_level: RiskLevelEnum.default("SAFE"),
  emergency_active: z.boolean().default(false),
  fault_code: z.string().nullable().default(null),
  reason: z.string().default("System in safe default idle state."),
  updated_at: z.string().datetime(),
});
export type SafetyState = z.infer<typeof SafetyStateSchema>;

export const RobotStateSchema = z.object({
  connection: ConnectionStateEnum.default("DISCONNECTED"),
  battery_percentage: z.number().min(0).max(100).default(0),
  linear_velocity_mps: z.number().default(0),
  angular_velocity_radps: z.number().default(0),
  emergency_stop_triggered: z.boolean().default(false),
  last_heartbeat: z.string().datetime().nullable().default(null),
  mode: OperatingModeEnum.default("SIMULATION"),
});
export type RobotState = z.infer<typeof RobotStateSchema>;

export const UserProfileSchema = z.object({
  user_id: z.string().default("U001"),
  name: z.string().default("Researcher / Subject"),
  experience_level: z.string().default("novice"),
  total_sessions: z.number().default(0),
  created_at: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const EEGLatestResponseSchema = z.object({
  timestamp: z.string().datetime(),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  sampling_rate_hz: z.number().default(250),
  samples: z.array(z.array(z.number())).default([]),
  signal_quality: SignalQualitySchema,
  is_live_stream: z.boolean().default(false),
  mode: OperatingModeEnum.default("SIMULATION"),
});
export type EEGLatestResponse = z.infer<typeof EEGLatestResponseSchema>;

export const EEGSpectrumResponseSchema = z.object({
  timestamp: z.string().datetime(),
  frequencies_hz: z.array(z.number()).default([]),
  mu_band_power: z.record(z.number()).default({ C3: 0, Cz: 0, C4: 0 }),
  beta_band_power: z.record(z.number()).default({ C3: 0, Cz: 0, C4: 0 }),
  erd_ers_percent: z.record(z.number()).default({ C3: 0, C4: 0 }),
});
export type EEGSpectrumResponse = z.infer<typeof EEGSpectrumResponseSchema>;

export const CalibrationStartRequestSchema = z.object({
  session_name: z.string().default("Calibration_01"),
  trials_per_class: z.number().min(5).max(100).default(20),
  intents: z.array(IntentEnum).default(["LEFT", "RIGHT", "STOP"]),
  trial_duration_sec: z.number().default(4.0),
});
export type CalibrationStartRequest = z.infer<
  typeof CalibrationStartRequestSchema
>;

export const CalibrationStartResponseSchema = z.object({
  session_id: z.string(),
  status: z.string().default("initiated"),
  message: z.string(),
  started_at: z.string().datetime(),
});
export type CalibrationStartResponse = z.infer<
  typeof CalibrationStartResponseSchema
>;

export const EmergencyStopResponseSchema = z.object({
  success: z.boolean(),
  state: RuntimeStateEnum,
  timestamp: z.string().datetime(),
  message: z.string(),
});
export type EmergencyStopResponse = z.infer<typeof EmergencyStopResponseSchema>;
