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
  "eeg_acquisition",
  "research",
  "sensors",
  "product",
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

  // Real EEG / BioAmp Acquisition (Phase 21)
  "EEG_ACQUISITION_DISCOVERED",
  "EEG_ACQUISITION_CONNECTING",
  "EEG_ACQUISITION_CONNECTED",
  "EEG_ACQUISITION_CONFIGURED",
  "EEG_ACQUISITION_CALIBRATING",
  "EEG_ACQUISITION_CALIBRATED",
  "EEG_ACQUISITION_STREAMING",
  "EEG_ACQUISITION_PAUSED",
  "EEG_ACQUISITION_DEGRADED",
  "EEG_ACQUISITION_STALE",
  "EEG_ACQUISITION_DISCONNECTED",
  "EEG_ACQUISITION_RECONNECTING",
  "EEG_ACQUISITION_DIAGNOSTIC",
  "EEG_ACQUISITION_HEALTH",
  "EEG_ACQUISITION_RECORDING_STARTED",
  "EEG_ACQUISITION_RECORDING_STOPPED",
  "EEG_ACQUISITION_REPLAY_STARTED",
  "EEG_ACQUISITION_REPLAY_STOPPED",
  "EEG_ACQUISITION_ERROR",

  // Deterministic Replay & Scientific Evaluation (Phase 22)
  "RESEARCH_EXPERIMENT_CREATED",
  "RESEARCH_EXPERIMENT_SEALED",
  "RESEARCH_EXPERIMENT_STARTED",
  "RESEARCH_EXPERIMENT_PAUSED",
  "RESEARCH_EXPERIMENT_RESUMED",
  "RESEARCH_EXPERIMENT_COMPLETED",
  "RESEARCH_EXPERIMENT_FAILED",
  "RESEARCH_EXPERIMENT_CANCELLED",
  "RESEARCH_REPLAY_STEP",
  "RESEARCH_REPLAY_CHECKPOINT",
  "RESEARCH_STAGE_COMPLETED",
  "RESEARCH_METRICS_UPDATED",
  "RESEARCH_ABLATION_COMPLETED",
  "RESEARCH_ROBUSTNESS_COMPLETED",
  "RESEARCH_COMPARISON_COMPLETED",
  "RESEARCH_REPRODUCIBILITY_CHECKED",
  "RESEARCH_ARTIFACT_EXPORTED",
  "RESEARCH_DIAGNOSTIC",
  "RESEARCH_ERROR",

  // Multimodal Sensors & Context Engine (Phase 23)
  "SENSOR_DISCOVERED",
  "SENSOR_CONNECTING",
  "SENSOR_CONNECTED",
  "SENSOR_CONFIGURED",
  "SENSOR_CALIBRATING",
  "SENSOR_CALIBRATED",
  "SENSOR_STREAMING",
  "SENSOR_PAUSED",
  "SENSOR_DEGRADED",
  "SENSOR_STALE",
  "SENSOR_DISCONNECTED",
  "SENSOR_RECONNECTING",
  "SENSOR_DIAGNOSTIC",
  "SENSOR_HEALTH_UPDATED",
  "SENSOR_SYNC_UPDATED",
  "SENSOR_FUSION_COMPLETED",
  "SENSOR_CONTEXT_UPDATED",
  "SENSOR_CONTRADICTION_DETECTED",
  "SENSOR_ERROR",

  // Final Product & Demo Orchestration (Phase 24.1)
  "PRODUCT_SESSION_CREATED",
  "PRODUCT_SESSION_READY",
  "PRODUCT_SESSION_RESET",
  "PRODUCT_DEMO_STARTED",
  "PRODUCT_DEMO_PAUSED",
  "PRODUCT_DEMO_RESUMED",
  "PRODUCT_DEMO_STEP_COMPLETED",
  "PRODUCT_STAGE_CHANGED",
  "PRODUCT_SAFETY_BLOCKED",
  "PRODUCT_HIL_COMPLETED",
  "PRODUCT_DEMO_COMPLETED",
  "PRODUCT_DEMO_FAILED",
]);
export type EventType = z.infer<typeof EventTypeEnum>;

// ============================================================================
// Phase 24.1: Final Competition Product Foundation & Demo Enums
// ============================================================================

export const ProductSessionStatusEnum = z.enum([
  "ACTIVE",
  "COMPLETED",
  "HELD",
  "RESET",
  "FAILED",
]);
export type ProductSessionStatus = z.infer<typeof ProductSessionStatusEnum>;

export const DemoStateEnum = z.enum([
  "IDLE",
  "SOURCE_READY",
  "ACQUIRING",
  "CONTEXT_READY",
  "DECODING",
  "CONFIRMING",
  "INTENT_READY",
  "SAFETY_CHECK",
  "AUTHORIZED",
  "HIL_EXECUTING",
  "COMPLETED",
  "HELD",
  "DENIED",
  "FAILED",
  "RECOVERING",
]);
export type DemoState = z.infer<typeof DemoStateEnum>;

export const SystemHealthStatusEnum = z.enum([
  "HEALTHY",
  "READY",
  "ACTIVE",
  "DEGRADED",
  "BLOCKED",
  "STALE",
  "ERROR",
]);
export type SystemHealthStatus = z.infer<typeof SystemHealthStatusEnum>;

export const ProductDemoScenarioEnum = z.enum([
  "PRODUCT_A",
  "PRODUCT_B",
  "PRODUCT_C",
  "PRODUCT_D",
  "PRODUCT_E",
  "PRODUCT_F",
]);
export type ProductDemoScenario = z.infer<typeof ProductDemoScenarioEnum>;

export const ProductStageEnum = z.enum([
  "SENSORS",
  "SIGNAL",
  "DECODING",
  "CONFIDENCE",
  "INTENT",
  "SAFETY",
  "HIL",
  "RESEARCH",
]);
export type ProductStage = z.infer<typeof ProductStageEnum>;

export const ProductExecutionOutcomeEnum = z.enum([
  "PASS",
  "BLOCKED",
  "FAILED",
]);
export type ProductExecutionOutcome = z.infer<typeof ProductExecutionOutcomeEnum>;

// ============================================================================
// Phase 23: Multimodal Sensors & Context Engine Enums
// ============================================================================

export const SensorModalityEnum = z.enum([
  "EEG",
  "IMU",
  "EMG",
  "EOG",
  "PPG",
  "PRESSURE",
  "AUXILIARY",
]);
export type SensorModality = z.infer<typeof SensorModalityEnum>;

export const SensorSourceEnum = z.enum([
  "PHYSICAL",
  "SIMULATOR",
  "RECORDED",
]);
export type SensorSource = z.infer<typeof SensorSourceEnum>;

export const SensorStateEnum = z.enum([
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
export type SensorState = z.infer<typeof SensorStateEnum>;

export const SynchronizationStatusEnum = z.enum([
  "SYNCHRONIZED",
  "DEGRADED",
  "UNSYNCHRONIZED",
  "DRIFT_DETECTED",
  "RESYNCING",
  "FAILED",
]);
export type SynchronizationStatus = z.infer<typeof SynchronizationStatusEnum>;

export const ContradictionOutcomeEnum = z.enum([
  "INFORMATIONAL",
  "DEGRADED",
  "HOLD",
  "INVALID",
]);
export type ContradictionOutcome = z.infer<typeof ContradictionOutcomeEnum>;

export const MotionContaminationStateEnum = z.enum([
  "MOTION_QUIET",
  "MOTION_ACTIVE",
  "LIKELY_CONTAMINATED",
  "UNKNOWN",
]);
export type MotionContaminationState = z.infer<typeof MotionContaminationStateEnum>;

export const FusionStrategyEnum = z.enum([
  "TEMPORAL_COINCIDENCE",
  "RULE_BASED_CONTEXT",
  "FEATURE_LEVEL",
  "DECISION_LEVEL",
  "CONFIDENCE_MODULATION",
  "CONTRADICTION_GATED",
]);
export type FusionStrategy = z.infer<typeof FusionStrategyEnum>;


