import { z } from "zod";
import { SafetyDecisionEnum } from "./enums";

// --- Protocol Version & Device Identifiers ---

export const ProtocolVersionSchema = z.string().default("1.0");
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

export const DeviceTypeEnum = z.enum([
  "ESP32_SIMULATOR",
  "ESP32_HARDWARE",
  "VIRTUAL_ENDPOINT",
]);
export type DeviceType = z.infer<typeof DeviceTypeEnum>;

export const CapabilityEnum = z.enum([
  "COMMAND_RECEIVE",
  "COMMAND_ACK",
  "COMMAND_NACK",
  "HEARTBEAT",
  "STATUS_REPORT",
  "SAFE_STOP",
  "SIMULATION",
]);
export type Capability = z.infer<typeof CapabilityEnum>;

export const DeviceIdentitySchema = z.object({
  device_id: z.string(),
  device_type: DeviceTypeEnum,
  firmware_version: z.string(),
  protocol_version: ProtocolVersionSchema,
  capabilities: z.array(CapabilityEnum),
  boot_id: z.string(),
  session_id: z.string().nullable().optional(),
});
export type DeviceIdentity = z.infer<typeof DeviceIdentitySchema>;

// --- Command Types & Envelopes ---

export const CommandTypeEnum = z.enum([
  "EXECUTE_INTENT",
  "CANCEL_INTENT",
  "STOP",
  "HEARTBEAT",
  "STATUS_REQUEST",
  "CAPABILITY_REQUEST",
  "PROTOCOL_NEGOTIATE",
]);
export type CommandType = z.infer<typeof CommandTypeEnum>;

export const TransportCommandStatusEnum = z.enum([
  "CREATED",
  "VALIDATED",
  "QUEUED",
  "SENT",
  "ACKED",
  "REJECTED",
  "RETRYING",
  "EXPIRED",
  "FAILED",
  "UNKNOWN",
  "CANCELLED",
  "DUPLICATE",
]);
export type TransportCommandStatus = z.infer<typeof TransportCommandStatusEnum>;

export const MessageTypeEnum = z.enum([
  "COMMAND",
  "ACK",
  "NACK",
  "HEARTBEAT_REQUEST",
  "HEARTBEAT_RESPONSE",
  "NEGOTIATE_REQUEST",
  "NEGOTIATE_RESPONSE",
]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

export const ExecutionAuthorizationSchema = z.object({
  authorization_id: z.string(),
  intent_id: z.string(),
  intent_class: z.string(),
  decision: SafetyDecisionEnum,
  policy_version: z.string(),
  evaluation_id: z.string(),
  model_version_id: z.string(),
  subject_id: z.string(),
  session_id: z.string(),
  issued_at: z.string(),
  expires_at: z.string(),
  reason: z.string(),
});
export type ExecutionAuthorization = z.infer<typeof ExecutionAuthorizationSchema>;

export const CommandPayloadSchema = z.object({
  intent_class: z.string(),
  parameters: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});
export type CommandPayload = z.infer<typeof CommandPayloadSchema>;

export const CommandEnvelopeSchema = z.object({
  protocol_version: ProtocolVersionSchema,
  message_type: MessageTypeEnum.default("COMMAND"),
  message_id: z.string(),
  command_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  device_id: z.string(),
  intent_id: z.string().optional(),
  authorization_id: z.string().optional(),
  subject_id: z.string().optional(),
  session_id: z.string().optional(),
  model_version_id: z.string().optional(),
  issued_at: z.string(),
  expires_at: z.string(),
  payload: CommandPayloadSchema,
  flags: z.record(z.boolean()).default({}),
  checksum: z.string(),
});
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

// --- ACK / NACK & Rejections ---

export const CommandAckStatusEnum = z.enum([
  "COMMAND_RECEIVED",
  "COMMAND_ACCEPTED",
  "COMMAND_REJECTED",
  "COMMAND_DUPLICATE",
  "COMMAND_EXPIRED",
  "COMMAND_INVALID",
]);
export type CommandAckStatus = z.infer<typeof CommandAckStatusEnum>;

export const CommandAckSchema = z.object({
  ack_id: z.string(),
  message_id: z.string(),
  command_id: z.string(),
  sequence_number: z.number().int().nonnegative(),
  status: CommandAckStatusEnum,
  timestamp: z.string(),
  reason: z.string().optional(),
  round_trip_ms: z.number().optional(),
});
export type CommandAck = z.infer<typeof CommandAckSchema>;

export const CommandNackSchema = z.object({
  nack_id: z.string(),
  message_id: z.string(),
  command_id: z.string().optional(),
  sequence_number: z.number().int().nonnegative().optional(),
  error_code: z.string(),
  reason: z.string(),
  retryable: z.boolean(),
  timestamp: z.string(),
});
export type CommandNack = z.infer<typeof CommandNackSchema>;

export const CommandRejectSchema = z.object({
  command_id: z.string().optional(),
  reason_code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  timestamp: z.string(),
});
export type CommandReject = z.infer<typeof CommandRejectSchema>;

// --- Connection & Framing ---

export const TransportConnectionStateEnum = z.enum([
  "DISCONNECTED",
  "CONNECTING",
  "NEGOTIATING",
  "CONNECTED",
  "DEGRADED",
  "STALE",
  "DISCONNECTING",
]);
export type TransportConnectionState = z.infer<typeof TransportConnectionStateEnum>;

export const TransportFrameSchema = z.object({
  frame_id: z.string(),
  length: z.number().int().positive(),
  checksum: z.string(),
  envelope: CommandEnvelopeSchema,
  raw_hex_preview: z.string().optional(),
  timestamp: z.string(),
});
export type TransportFrame = z.infer<typeof TransportFrameSchema>;

// --- Heartbeat & Reliability ---

export const HeartbeatStatusSchema = z.object({
  last_sent: z.string().nullable(),
  last_received: z.string().nullable(),
  round_trip_time_ms: z.number().nullable(),
  missed_count: z.number().int().nonnegative(),
  link_state: TransportConnectionStateEnum,
});
export type HeartbeatStatus = z.infer<typeof HeartbeatStatusSchema>;

export const RetryPolicySchema = z.object({
  max_attempts: z.number().int().min(1).max(10).default(3),
  initial_delay_ms: z.number().min(10).max(5000).default(100),
  backoff_multiplier: z.number().min(1.0).max(5.0).default(2.0),
  max_delay_ms: z.number().min(100).max(60000).default(2000),
  jitter_enabled: z.boolean().default(false),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

// --- Observability & Diagnostics ---

export const CommandTraceDirectionEnum = z.enum(["TX", "RX"]);
export type CommandTraceDirection = z.infer<typeof CommandTraceDirectionEnum>;

export const CommandTraceDecodeStatusEnum = z.enum([
  "VALID",
  "CORRUPTED",
  "DROPPED",
  "TRUNCATED",
]);
export type CommandTraceDecodeStatus = z.infer<typeof CommandTraceDecodeStatusEnum>;

export const CommandTraceSchema = z.object({
  trace_id: z.string(),
  timestamp: z.string(),
  direction: CommandTraceDirectionEnum,
  device_id: z.string(),
  message_id: z.string(),
  command_id: z.string().optional(),
  sequence_number: z.number().int().nonnegative(),
  message_type: z.string(),
  length_bytes: z.number().int().nonnegative(),
  checksum: z.string(),
  decode_status: CommandTraceDecodeStatusEnum,
  ack_status: z.string().optional(),
  latency_ms: z.number().optional(),
  error_code: z.string().optional(),
});
export type CommandTrace = z.infer<typeof CommandTraceSchema>;

export const TransportMetricsSchema = z.object({
  commands_sent: z.number().int().nonnegative(),
  commands_acknowledged: z.number().int().nonnegative(),
  commands_rejected: z.number().int().nonnegative(),
  commands_duplicated: z.number().int().nonnegative(),
  commands_expired: z.number().int().nonnegative(),
  retries_total: z.number().int().nonnegative(),
  timeouts_total: z.number().int().nonnegative(),
  checksum_failures: z.number().int().nonnegative(),
  sequence_gaps: z.number().int().nonnegative(),
  sequence_duplicates: z.number().int().nonnegative(),
  heartbeat_failures: z.number().int().nonnegative(),
  reconnections: z.number().int().nonnegative(),
  average_rtt_ms: z.number().nonnegative(),
  p95_rtt_ms: z.number().nonnegative(),
});
export type TransportMetrics = z.infer<typeof TransportMetricsSchema>;

export const TransportLabStatusSchema = z.object({
  connection_state: TransportConnectionStateEnum,
  device: DeviceIdentitySchema.nullable(),
  negotiated_capabilities: z.array(CapabilityEnum),
  heartbeat: HeartbeatStatusSchema,
  metrics: TransportMetricsSchema,
  active_commands_count: z.number().int().nonnegative(),
  simulated_mode: z.boolean(),
  updated_at: z.string(),
});
export type TransportLabStatus = z.infer<typeof TransportLabStatusSchema>;

export const TransportScenarioResultSchema = z.object({
  scenario_id: z.string(),
  name: z.string(),
  description: z.string(),
  passed: z.boolean(),
  expected_state: z.string(),
  observed_state: z.string(),
  expected_ack_status: z.string(),
  observed_ack_status: z.string(),
  retries_observed: z.number().int().nonnegative(),
  details: z.record(z.unknown()).default({}),
  timestamp: z.string(),
});
export type TransportScenarioResult = z.infer<typeof TransportScenarioResultSchema>;
