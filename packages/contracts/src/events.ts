import { z } from "zod";
import {
  EventTypeEnum,
  IntentEnum,
  OperatingModeEnum,
  RiskLevelEnum,
  RuntimeStateEnum,
  SafetyDecisionEnum,
} from "./enums";

export const DecisionPayloadSchema = z.object({
  intent: IntentEnum.default("NONE"),
  confidence: z.number().min(0).max(1).default(0),
  signal_quality: z.number().min(0).max(1).default(0),
  risk: RiskLevelEnum.default("SAFE"),
  decision: SafetyDecisionEnum.default("STOP"),
  runtime_state: RuntimeStateEnum.default("IDLE"),
  rationale: z.string().default(""),
});
export type DecisionPayload = z.infer<typeof DecisionPayloadSchema>;

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
  command_id: z.string(),
  intent: IntentEnum,
  linear_velocity: z.number().default(0),
  angular_velocity: z.number().default(0),
  duration_ms: z.number().default(500),
  safety_decision: SafetyDecisionEnum.default("APPROVED"),
});
export type RobotCommandPayload = z.infer<typeof RobotCommandPayloadSchema>;

export const EventEnvelopeSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    event_id: z.string(),
    version: z.string().default("1.0.0"),
    timestamp: z.string().datetime(),
    session_id: z.string().default("SESS_DEFAULT"),
    user_id: z.string().default("USER_DEFAULT"),
    mode: OperatingModeEnum.default("SIMULATION"),
    event_type: EventTypeEnum,
    correlation_id: z.string(),
    source_component: z.string().default("neuromove-core"),
    payload: payloadSchema,
  });

export type GenericEventEnvelope<T> = {
  event_id: string;
  version: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  mode: z.infer<typeof OperatingModeEnum>;
  event_type: z.infer<typeof EventTypeEnum>;
  correlation_id: string;
  source_component: string;
  payload: T;
};
