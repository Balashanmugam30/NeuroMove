import { z } from "zod";
import {
  CommandStatusEnum,
  ComponentStatusEnum,
  ConnectionStateEnum,
  IntentEnum,
  OperatingModeEnum,
  RiskLevelEnum,
  RuntimeStateEnum,
  SafetyDecisionEnum,
  SessionStatusEnum,
  TrialQualityEnum,
} from "./enums";

export const UserSchema = z.object({
  user_id: z.string().startsWith("usr_"),
  display_label: z.string().default("Subject_001"),
  created_at: z.string().datetime(),
  status: z.string().default("active"),
  profile_version: z.string().default("1.0.0"),
});
export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  session_id: z.string().startsWith("ses_"),
  user_id: z.string().startsWith("usr_"),
  mode: OperatingModeEnum.default("SIMULATION"),
  status: SessionStatusEnum.default("CREATED"),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable().optional(),
  source: z.string().default("synthetic.generator"),
  application_version: z.string().default("0.1.0"),
  model_version: z.string().default("baseline_csp_lda_v1"),
  notes: z.string().default(""),
  metadata: z.record(z.any()).default({}),
});
export type Session = z.infer<typeof SessionSchema>;

export const TrialSchema = z.object({
  trial_id: z.string().startsWith("trl_"),
  session_id: z.string().startsWith("ses_"),
  trial_index: z.number().int().min(0),
  label: IntentEnum,
  paradigm: z.string().default("Graz_Visual_Cue"),
  cue: z.string().default("ARROW_RIGHT"),
  started_at: z.string().datetime(),
  imagery_started_at: z.string().datetime().nullable().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  duration_ms: z.number().int().min(500).default(4000),
  quality_status: TrialQualityEnum.default("VALID"),
});
export type Trial = z.infer<typeof TrialSchema>;

export const ExperimentSchema = z.object({
  experiment_id: z.string().startsWith("exp_"),
  name: z.string().default("Motor Imagery SMR Benchmark"),
  description: z.string().default(""),
  protocol_version: z.string().default("2.0.0"),
  dataset_source: z.string().default("local.research"),
  model_id: z.string().startsWith("mdl_").nullable().optional(),
  created_at: z.string().datetime(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const ModelArtifactSchema = z.object({
  model_id: z.string().startsWith("mdl_"),
  model_type: z.string().default("CSP_LDA"),
  version: z.string().default("1.0.0"),
  created_at: z.string().datetime(),
  training_dataset: z.string().default("synthetic_sim_v1"),
  feature_pipeline: z.string().default("Butterworth_8_30Hz_CAR_CSP"),
  classifier: z.string().default("Shrinkage_LDA"),
  metrics_reference: z.record(z.number()).default({}),
  artifact_path: z.string().default(""),
  status: z.string().default("ready"),
});
export type ModelArtifact = z.infer<typeof ModelArtifactSchema>;

export const SignalQualityMetricsSchema = z.object({
  overall_score: z.number().min(0).max(1).default(0),
  channels: z.record(z.number()).default({ C3: 0, Cz: 0, C4: 0 }),
  dropped_samples: z.number().int().min(0).default(0),
  artifact_flags: z.array(z.string()).default([]),
  sampling_rate_hz: z.number().min(100).default(250),
  is_acceptable: z.boolean().default(false),
});
export type SignalQualityMetrics = z.infer<typeof SignalQualityMetricsSchema>;

export const SafetyStateSchema = z
  .object({
    runtime_state: RuntimeStateEnum.default("IDLE"),
    last_decision: SafetyDecisionEnum.default("STOP"),
    risk_level: RiskLevelEnum.default("SAFE"),
    emergency_active: z.boolean().default(false),
    fault_code: z.string().nullable().default(null),
    reason_code: z.string().default("SYS_IDLE"),
    reason: z.string().default("System in safe default idle state."),
    updated_at: z.string().datetime(),
  })
  .refine(
    (data) => !(data.emergency_active && data.last_decision === "APPROVED"),
    {
      message:
        "Emergency stop active cannot coexist with APPROVED safety decision.",
    },
  );
export type SafetyState = z.infer<typeof SafetyStateSchema>;

export const RobotStateSchema = z.object({
  connection_state: ConnectionStateEnum.default("DISCONNECTED"),
  motion_state: z.string().default("STOPPED"),
  heading_deg: z.number().min(0).max(360).default(0),
  battery_pct: z.number().min(0).max(100).default(0),
  left_motor_pwm: z.number().int().min(-255).max(255).default(0),
  right_motor_pwm: z.number().int().min(-255).max(255).default(0),
  linear_velocity_mps: z.number().default(0),
  angular_velocity_radps: z.number().default(0),
  emergency_stop_triggered: z.boolean().default(false),
  last_heartbeat: z.string().datetime().nullable().default(null),
  mode: OperatingModeEnum.default("SIMULATION"),
});
export type RobotState = z.infer<typeof RobotStateSchema>;

export const RobotCommandSchema = z
  .object({
    command_id: z.string().startsWith("cmd_"),
    intent: IntentEnum.default("NONE"),
    source: z.string().default("safety.arbitrator"),
    session_id: z.string().nullable().optional(),
    correlation_id: z.string().nullable().optional(),
    requested_at: z.string().datetime(),
    safety_decision: SafetyDecisionEnum.default("STOP"),
    status: CommandStatusEnum.default("REQUESTED"),
    linear_velocity_mps: z.number().min(-0.5).max(0.5).default(0),
    angular_velocity_radps: z.number().min(-1.5).max(1.5).default(0),
    duration_ms: z.number().int().min(50).max(2000).default(500),
  })
  .refine(
    (data) =>
      !(
        (data.intent === "NONE" || data.intent === "UNCERTAIN") &&
        data.status === "APPROVED"
      ),
    {
      message: "Non-directional intents cannot be approved for movement.",
    },
  );
export type RobotCommand = z.infer<typeof RobotCommandSchema>;

export const ObstacleDataSchema = z.object({
  front_cm: z.number().min(0).default(200),
  left_cm: z.number().min(0).default(200),
  right_cm: z.number().min(0).default(200),
  obstacle_present: z.boolean().default(false),
  direction: z.enum(["FRONT", "LEFT", "RIGHT", "NONE"]).default("NONE"),
  distance_cm: z.number().min(0).default(200),
  confidence: z.number().min(0).max(1).default(0.98),
});
export type ObstacleData = z.infer<typeof ObstacleDataSchema>;

export const ScenarioStepSchema = z.object({
  time_seconds: z.number(),
  cue: z.string().default("REST"),
  target_intent: IntentEnum.default("NONE"),
  confidence_profile: z.string().default("HIGH"),
  obstacle_direction: z.string().default("NONE"),
  obstacle_distance_cm: z.number().default(200),
  inject_fault: z.string().nullable().optional(),
  trigger_emergency: z.boolean().default(false),
  description: z.string().default(""),
});
export type ScenarioStep = z.infer<typeof ScenarioStepSchema>;

export const SimulationScenarioSchema = z.object({
  scenario_id: z.string(),
  name: z.string(),
  description: z.string(),
  seed: z.number().int().default(42),
  duration_seconds: z.number().default(12),
  trials_count: z.number().int().default(1),
  expected_behavior: z.string().default(""),
  steps: z.array(ScenarioStepSchema).default([]),
});
export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;

export const SimulationStatusSchema = z.object({
  is_running: z.boolean().default(false),
  is_paused: z.boolean().default(false),
  mode: OperatingModeEnum.default("SIMULATION"),
  scenario_id: z.string().nullable().optional(),
  scenario_name: z.string().nullable().optional(),
  seed: z.number().int().default(42),
  speed: z.number().default(1.0),
  elapsed_seconds: z.number().default(0),
  total_duration_seconds: z.number().default(0),
  active_session_id: z.string().nullable().optional(),
  active_trial_id: z.string().nullable().optional(),
  current_intent: IntentEnum.default("NONE"),
  current_cue: z.string().default("REST"),
  runtime_state: RuntimeStateEnum.default("IDLE"),
  safety_decision: SafetyDecisionEnum.default("STOP"),
  signal_quality: SignalQualityMetricsSchema.nullable().optional(),
  robot_state: RobotStateSchema.nullable().optional(),
  obstacle_data: ObstacleDataSchema.nullable().optional(),
  active_faults: z.array(z.string()).default([]),
});
export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

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

export const EEGLatestResponseSchema = z.object({
  timestamp: z.string().datetime(),
  channels: z.array(z.string()).default(["C3", "Cz", "C4"]),
  sampling_rate_hz: z.number().default(250),
  samples: z.array(z.record(z.any())).default([]),
  signal_quality: SignalQualityMetricsSchema,
  is_live_stream: z.boolean().default(false),
  mode: OperatingModeEnum.default("SIMULATION"),
});
export type EEGLatestResponse = z.infer<typeof EEGLatestResponseSchema>;

export const EmergencyStopResponseSchema = z.object({
  success: z.boolean().default(true),
  state: RuntimeStateEnum.default("EMERGENCY"),
  timestamp: z.string().datetime(),
  message: z.string(),
});
export type EmergencyStopResponse = z.infer<typeof EmergencyStopResponseSchema>;

export const ErrorDetailSchema = z.object({
  field: z.string(),
  issue: z.string(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  request_id: z.string(),
  details: z.array(ErrorDetailSchema).default([]),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
