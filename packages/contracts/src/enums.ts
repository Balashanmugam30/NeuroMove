import { z } from "zod";

export const OperatingModeEnum = z.enum(["LIVE", "REPLAY", "SIMULATION"]);
export type OperatingMode = z.infer<typeof OperatingModeEnum>;

export const IntentEnum = z.enum([
  "NONE",
  "LEFT",
  "RIGHT",
  "FORWARD",
  "BACKWARD",
  "STOP",
  "UNCERTAIN",
]);
export type Intent = z.infer<typeof IntentEnum>;

export const RuntimeStateEnum = z.enum([
  "IDLE",
  "CALIBRATING",
  "READY",
  "CANDIDATE",
  "CONFIRMED",
  "EXECUTING",
  "BLOCKED",
  "EMERGENCY",
  "FAULT",
  "UNCERTAIN",
]);
export type RuntimeState = z.infer<typeof RuntimeStateEnum>;

export const SafetyDecisionEnum = z.enum(["APPROVED", "BLOCKED", "STOP"]);
export type SafetyDecision = z.infer<typeof SafetyDecisionEnum>;

export const RiskLevelEnum = z.enum(["SAFE", "WARNING", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

export const ConnectionStateEnum = z.enum([
  "CONNECTED",
  "DEGRADED",
  "DISCONNECTED",
]);
export type ConnectionState = z.infer<typeof ConnectionStateEnum>;

export const ComponentStatusEnum = z.enum([
  "healthy",
  "ready",
  "degraded",
  "not_connected",
  "not_initialized",
  "unavailable",
  "error",
]);
export type ComponentStatus = z.infer<typeof ComponentStatusEnum>;

export const EventTypeEnum = z.enum([
  "SYSTEM_STATUS",
  "STATE_TRANSITION",
  "INTENT_CANDIDATE",
  "INTENT_CONFIRMED",
  "DECISION",
  "SAFETY_ALERT",
  "EMERGENCY_STOP",
  "ROBOT_COMMAND",
  "TELEMETRY",
  "CALIBRATION",
]);
export type EventType = z.infer<typeof EventTypeEnum>;
