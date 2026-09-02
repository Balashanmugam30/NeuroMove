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

export const SafetyDecisionEnum = z.enum([
  "AUTHORIZED",
  "HELD",
  "DENIED",
  "EMERGENCY_STOP",
  "LOCKED_OUT",
  "INVALID",
  "APPROVED",
  "BLOCKED",
  "STOP",
]);
export type SafetyDecision = z.infer<typeof SafetyDecisionEnum>;

export const RiskLevelEnum = z.enum(["SAFE", "WARNING", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

export const ConnectionStateEnum = z.enum([
  "CONNECTED",
  "DEGRADED",
  "DISCONNECTED",
]);
export type ConnectionState = z.infer<typeof ConnectionStateEnum>;

export const CommandStatusEnum = z.enum([
  "REQUESTED",
  "APPROVED",
  "BLOCKED",
  "SENT",
  "ACKNOWLEDGED",
  "FAILED",
  "CANCELLED",
]);
export type CommandStatus = z.infer<typeof CommandStatusEnum>;

export const SessionStatusEnum = z.enum([
  "CREATED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ABORTED",
]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const TrialQualityEnum = z.enum(["VALID", "DEGRADED", "REJECTED"]);
export type TrialQuality = z.infer<typeof TrialQualityEnum>;

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

// --- Transport & Realtime Enums (Phase 04) ---

export const TransportMessageTypeEnum = z.enum([
  "HELLO",
  "WELCOME",
  "PING",
  "PONG",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "EVENT",
  "SNAPSHOT",
  "RESET",
  "ERROR",
]);
export type TransportMessageType = z.infer<typeof TransportMessageTypeEnum>;

export const TransportStreamEnum = z.enum([
  "live",
  "eeg",
  "robot",
  "safety",
  "confidence",
  "intent",
  "resilience",
  "transport",
  "hardware",
  "all",
]);
export type TransportStream = z.infer<typeof TransportStreamEnum>;

export const DataFreshnessEnum = z.enum(["FRESH", "STALE", "DISCONNECTED"]);
export type DataFreshness = z.infer<typeof DataFreshnessEnum>;

export const ClientLifecycleStateEnum = z.enum([
  "CONNECTING",
  "CONNECTED",
  "SUBSCRIBING",
  "STREAMING",
  "DEGRADED",
  "DISCONNECTED",
  "RECONNECTING",
]);
export type ClientLifecycleState = z.infer<typeof ClientLifecycleStateEnum>;

export const EventTypeEnum = z.enum([
  // System Lifecycle & Health
  "SYSTEM_STARTED",
  "SYSTEM_STOPPED",
  "SYSTEM_STATUS",

  // Session Lifecycle
  "SESSION_CREATED",
  "SESSION_STARTED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_ENDED",

  // Trial Protocol
  "TRIAL_STARTED",
  "TRIAL_CUE",
  "TRIAL_IMAGERY_STARTED",
  "TRIAL_ENDED",

  // EEG Stream & Signal Quality
  "EEG_PACKET",
  "EEG_WINDOW",
  "EEG_SIGNAL_QUALITY",
  "EEG_DISCONNECTED",
  "TELEMETRY",

  // BCI Prediction & Intent Lifecycle (Phase 16)
  "PREDICTION",
  "INTENT_CANDIDATE",
  "INTENT_CONFIRMED",
  "INTENT_ACTIVATED",
  "INTENT_CANCELLED",
  "INTENT_EXPIRED",
  "INTENT_INTERRUPTED",
  "INTENT_COMPLETED",
  "INTENT_REPLACEMENT_REQUESTED",
  "INTENT_STATE_CHANGED",
  "INTENT_CONTEXT_RESET",
  "INTENT_REJECTED",


  // Confidence & Temporal Confirmation (Phase 15)
  "CONFIDENCE_EVALUATED",
  "CONFIDENCE_REJECTED",
  "TEMPORAL_EVIDENCE_UPDATED",
  "TEMPORAL_CONFIRMATION_REACHED",
  "TEMPORAL_CONFIRMATION_RESET",
  "CONFIDENCE_STATE_EXPIRED",
  "CONFIDENCE_CONFIG_CHANGED",

  // Safety State Machine & Arbitration (Phase 17)
  "SAFETY_EVALUATED",
  "SAFETY_AUTHORIZED",
  "SAFETY_HELD",
  "SAFETY_DENIED",
  "SAFETY_EMERGENCY_STOP",
  "SAFETY_LOCKED_OUT",
  "SAFETY_RESET",
  "SAFETY_HOLD_CHANGED",
  "SAFETY_CONTEXT_CHANGED",
  "STATE_TRANSITION",
  "SAFETY_CHECK",
  "SAFETY_APPROVED",
  "SAFETY_BLOCKED",
  "SAFETY_STOP",
  "EMERGENCY_STOP",
  "SAFETY_ALERT",
  "DECISION",
  "FAULT",

  // Robot Mobility & Command Protocol
  "ROBOT_STATE",
  "ROBOT_COMMAND_REQUESTED",
  "ROBOT_COMMAND_APPROVED",
  "ROBOT_COMMAND_BLOCKED",
  "ROBOT_COMMAND_SENT",
  "ROBOT_COMMAND_ACK",
  "ROBOT_COMMAND_FAILED",
  "ROBOT_COMMAND",

  // Calibration Protocols
  "CALIBRATION_STARTED",
  "CALIBRATION_TRIAL",
  "CALIBRATION_COMPLETED",
  "CALIBRATION_FAILED",
  "CALIBRATION",

  // Experiment Management
  "EXPERIMENT_CREATED",
  "EXPERIMENT_STARTED",
  "EXPERIMENT_COMPLETED",

  // Fault Laboratory & Resilience (Phase 18)
  "FAULT_DECLARED",
  "FAULT_ACTIVE",
  "FAULT_DETECTED",
  "FAULT_CLEARED",
  "RECOVERY_STARTED",
  "RECOVERY_COMPLETED",
  "RECOVERY_FAILED",
  "INVARIANT_PASSED",
  "INVARIANT_FAILED",
  "RESILIENCE_EXPERIMENT_STARTED",
  "RESILIENCE_EXPERIMENT_COMPLETED",

  // Command Transport & ESP32 Protocol (Phase 19)
  "TRANSPORT_CONNECTED",
  "TRANSPORT_DISCONNECTED",
  "TRANSPORT_NEGOTIATING",
  "TRANSPORT_NEGOTIATED",
  "TRANSPORT_DEGRADED",
  "TRANSPORT_COMMAND_CREATED",
  "TRANSPORT_COMMAND_SENT",
  "TRANSPORT_COMMAND_ACKED",
  "TRANSPORT_COMMAND_REJECTED",
  "TRANSPORT_COMMAND_RETRIED",
  "TRANSPORT_COMMAND_EXPIRED",
  "TRANSPORT_SEQUENCE_GAP",
  "TRANSPORT_CHECKSUM_FAILURE",
  "TRANSPORT_HEARTBEAT",

  // Hardware-in-the-Loop & ESP32 Adapter (Phase 20)
  "HARDWARE_DISCOVERED",
  "HARDWARE_CONNECTING",
  "HARDWARE_CONNECTED",
  "HARDWARE_NEGOTIATING",
  "HARDWARE_NEGOTIATED",
  "HARDWARE_READY",
  "HARDWARE_DEGRADED",
  "HARDWARE_STALE",
  "HARDWARE_DISCONNECTED",
  "HARDWARE_RECONNECTING",
  "HARDWARE_REBOOTED",
  "HARDWARE_CAPABILITIES_UPDATED",
  "HARDWARE_COMMAND_STATUS",
  "HARDWARE_DIAGNOSTIC",
  "HARDWARE_ERROR",
]);
export type EventType = z.infer<typeof EventTypeEnum>;

