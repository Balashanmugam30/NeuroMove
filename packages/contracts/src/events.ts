import { z } from "zod";
import {
  CommandStatusEnum,
  ConnectionStateEnum,
  EventTypeEnum,
  IntentEnum,
  OperatingModeEnum,
  RiskLevelEnum,
  RuntimeStateEnum,
  SafetyDecisionEnum,
  SessionStatusEnum,
  TrialQualityEnum,
} from "./enums";

export const PredictionPayloadSchema = z.object({
  intent: IntentEnum,
  class_probabilities: z.record(z.number()).default({}),
  neural_confidence: z.number().min(0).max(1),
  raw_label: z.string().default(""),
  model_id: z.string().default("mdl_baseline"),
  model_version: z.string().default("1.0.0"),
  window_id: z.string().default("win_001"),
});
export type PredictionPayload = z.infer<typeof PredictionPayloadSchema>;

export const IntentConfirmedPayloadSchema = z.object({
  intent: IntentEnum,
  confidence: z.number().min(0).max(1),
  confirmation_window_ms: z.number().min(100).default(350),
  consecutive_epochs: z.number().min(1).default(3),
});
export type IntentConfirmedPayload = z.infer<
  typeof IntentConfirmedPayloadSchema
>;

export const SignalQualityPayloadSchema = z.object({
  quality_score: z.number().min(0).max(1),
  channels: z.record(z.number()).default({ C3: 0, Cz: 0, C4: 0 }),
  dropped_samples: z.number().int().min(0).default(0),
  artifact_flags: z.array(z.string()).default([]),
  sampling_rate: z.number().min(100).default(250),
});
export type SignalQualityPayload = z.infer<typeof SignalQualityPayloadSchema>;

export const SafetyDecisionPayloadSchema = z.object({
  decision: SafetyDecisionEnum,
  risk_level: RiskLevelEnum.default("SAFE"),
  reason_code: z.string().default("DECISION_OK"),
  reason: z.string().default(""),
  evaluated_at: z.string().datetime(),
  intent: IntentEnum.default("NONE"),
  neural_confidence: z.number().min(0).max(1).default(0),
  signal_quality: z.number().min(0).max(1).default(0),
  obstacle_state: z.string().default("CLEAR"),
  emergency_state: z.boolean().default(false),
  robot_state: z.string().default("STOPPED"),
});
export type SafetyDecisionPayload = z.infer<typeof SafetyDecisionPayloadSchema>;

export const StateTransitionPayloadSchema = z.object({
  previous_state: RuntimeStateEnum,
  target_state: RuntimeStateEnum,
  trigger_event: z.string(),
  is_valid: z.boolean().default(true),
  reason: z.string().default(""),
});
export type StateTransitionPayload = z.infer<
  typeof StateTransitionPayloadSchema
>;

export const SafetyAlertPayloadSchema = z.object({
  severity: RiskLevelEnum.default("CRITICAL"),
  alert_code: z.string(),
  message: z.string(),
  requires_acknowledgement: z.boolean().default(true),
  telemetry_snapshot: z.record(z.any()).default({}),
});
export type SafetyAlertPayload = z.infer<typeof SafetyAlertPayloadSchema>;

export const RobotCommandPayloadSchema = z.object({
  command_id: z.string().startsWith("cmd_"),
  intent: IntentEnum,
  linear_velocity: z.number().default(0),
  angular_velocity: z.number().default(0),
  duration_ms: z.number().default(500),
  safety_decision: SafetyDecisionEnum.default("APPROVED"),
  status: CommandStatusEnum.default("REQUESTED"),
});
export type RobotCommandPayload = z.infer<typeof RobotCommandPayloadSchema>;

export const RobotStatePayloadSchema = z.object({
  connection_state: ConnectionStateEnum.default("DISCONNECTED"),
  motion_state: z.string().default("STOPPED"),
  heading: z.number().default(0),
  battery: z.number().default(0),
  left_motor: z.number().default(0),
  right_motor: z.number().default(0),
  linear_velocity: z.number().default(0),
  angular_velocity: z.number().default(0),
});
export type RobotStatePayload = z.infer<typeof RobotStatePayloadSchema>;

export const SystemStatusPayloadSchema = z.object({
  service: z.string().default("neuromove-core"),
  status: z.string().default("ok"),
  version: z.string().default("0.1.0"),
  mode: OperatingModeEnum.default("SIMULATION"),
  components: z.record(z.string()).default({}),
});
export type SystemStatusPayload = z.infer<typeof SystemStatusPayloadSchema>;

export const SessionLifecyclePayloadSchema = z.object({
  session_id: z.string().startsWith("ses_"),
  user_id: z.string().startsWith("usr_"),
  status: SessionStatusEnum,
  mode: OperatingModeEnum.default("SIMULATION"),
});
export type SessionLifecyclePayload = z.infer<
  typeof SessionLifecyclePayloadSchema
>;

export const TrialLifecyclePayloadSchema = z.object({
  trial_id: z.string().startsWith("trl_"),
  session_id: z.string().startsWith("ses_"),
  trial_index: z.number().int().min(0),
  label: IntentEnum,
  cue: z.string().default("ARROW_RIGHT"),
  status: TrialQualityEnum.default("VALID"),
});
export type TrialLifecyclePayload = z.infer<typeof TrialLifecyclePayloadSchema>;

export const CalibrationPayloadSchema = z.object({
  session_id: z.string().startsWith("ses_"),
  trial_index: z.number().int().min(0),
  target_intent: IntentEnum,
  status: z.string().default("in_progress"),
});
export type CalibrationPayload = z.infer<typeof CalibrationPayloadSchema>;

export const EventEnvelopeSchema = z.object({
  event_id: z.string().startsWith("evt_"),
  schema_version: z.string().default("1.0.0"),
  timestamp: z.string().datetime(),
  occurred_at: z.string().datetime(),
  processed_at: z.string().datetime().nullable().optional(),
  mode: OperatingModeEnum.default("SIMULATION"),
  event_type: EventTypeEnum,
  session_id: z.string().startsWith("ses_").nullable().optional(),
  trial_id: z.string().startsWith("trl_").nullable().optional(),
  user_id: z.string().startsWith("usr_").nullable().optional(),
  correlation_id: z.string().startsWith("cor_"),
  source: z.string().default("neuromove.core"),
  sequence: z.number().int().min(0).default(0),
  payload: z.record(z.any()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
