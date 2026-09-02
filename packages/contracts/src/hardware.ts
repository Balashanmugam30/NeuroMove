/**
 * NeuroMove — Phase 20 Shared Hardware-in-the-Loop & ESP32 Adapter Contracts
 *
 * Provides strongly typed Zod schemas and TypeScript interfaces for the
 * Hardware-in-the-Loop (HIL) integration, virtual serial transport,
 * ESP32-compatible endpoint adapter, and deterministic verification layer.
 */

import { z } from "zod";
import {
  CapabilityEnum,
  HeartbeatStatusSchema,
  TransportMetricsSchema,
} from "./transport";

// ============================================================================
// Endpoint Modes & Connection States
// ============================================================================

export const HardwareEndpointModeEnum = z.enum([
  "SIMULATOR",
  "VIRTUAL_SERIAL",
  "HIL_ESP32",
]);
export type HardwareEndpointMode = z.infer<typeof HardwareEndpointModeEnum>;

export const HardwareConnectionStateEnum = z.enum([
  "DISCONNECTED",
  "DISCOVERING",
  "CONNECTING",
  "NEGOTIATING",
  "CONNECTED",
  "READY",
  "DEGRADED",
  "STALE",
  "RECONNECTING",
  "ERROR",
]);
export type HardwareConnectionState = z.infer<typeof HardwareConnectionStateEnum>;

// ============================================================================
// Serial Port Descriptor
// ============================================================================

export const SerialPortDescriptorSchema = z.object({
  port: z.string(),
  description: z.string(),
  manufacturer: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  vid: z.string().nullable().optional(),
  pid: z.string().nullable().optional(),
  device_hint: z.string().nullable().optional(),
  is_open: z.boolean().default(false),
  baud_rate: z.number().default(115200),
});
export type SerialPortDescriptor = z.infer<typeof SerialPortDescriptorSchema>;

// ============================================================================
// Firmware Identity & Device Info
// ============================================================================

export const FirmwareIdentitySchema = z.object({
  firmware_name: z.string(),
  firmware_version: z.string(),
  build_hash: z.string(),
  compiled_at: z.string(),
  target_mcu: z.string().default("ESP32-S3"),
  is_hil_only: z.boolean().default(true),
});
export type FirmwareIdentity = z.infer<typeof FirmwareIdentitySchema>;

export const Esp32DeviceInfoSchema = z.object({
  device_id: z.string(),
  device_type: z.string().default("ESP32_HIL_ENDPOINT"),
  device_mode: HardwareEndpointModeEnum,
  firmware_version: z.string(),
  firmware_build: z.string().default("rel-2026.09.01"),
  protocol_version: z.string().default("1.0"),
  boot_id: z.string(),
  hardware_revision: z.string().default("ESP32-DevKitC-v4"),
  capabilities: z.array(z.string()),
  uptime_ms: z.number().nonnegative().default(0),
  hashed_serial_identifier: z.string().nullable().optional(),
  last_seen: z.string(),
});
export type Esp32DeviceInfo = z.infer<typeof Esp32DeviceInfoSchema>;

// ============================================================================
// Hardware Status & Health Telemetry
// ============================================================================

export const HardwareHealthSchema = z.object({
  link_state: HardwareConnectionStateEnum,
  application_healthy: z.boolean(),
  device_connected: z.boolean(),
  device_ready: z.boolean(),
  heartbeat_healthy: z.boolean(),
  command_channel_healthy: z.boolean(),
  round_trip_time_ms: z.number().nullable().optional(),
  missed_heartbeats: z.number().nonnegative().default(0),
});
export type HardwareHealth = z.infer<typeof HardwareHealthSchema>;

export const HardwareStatusSchema = z.object({
  connection_state: HardwareConnectionStateEnum,
  active_mode: HardwareEndpointModeEnum,
  device: Esp32DeviceInfoSchema.nullable().optional(),
  firmware: FirmwareIdentitySchema.nullable().optional(),
  session_id: z.string().nullable().optional(),
  boot_id: z.string().nullable().optional(),
  heartbeat: HeartbeatStatusSchema.nullable().optional(),
  health: HardwareHealthSchema.nullable().optional(),
  metrics: TransportMetricsSchema.nullable().optional(),
  simulated_mode: z.boolean().default(true),
  updated_at: z.string(),
});
export type HardwareStatus = z.infer<typeof HardwareStatusSchema>;

// ============================================================================
// Hardware Sessions & Handshake
// ============================================================================

export const HardwareHandshakeSchema = z.object({
  client_protocol_version: z.string().default("1.0"),
  host_id: z.string().default("neuromove_host_01"),
  session_id: z.string(),
  requested_capabilities: z.array(z.string()).default([
    "COMMAND_RECEIVE",
    "COMMAND_ACK",
    "COMMAND_NACK",
    "HEARTBEAT",
    "STATUS_REPORT",
    "SAFE_STOP",
    "HIL_ONLY",
    "NO_ACTUATION",
  ]),
  timestamp: z.string(),
});
export type HardwareHandshake = z.infer<typeof HardwareHandshakeSchema>;

export const HardwareSessionSchema = z.object({
  session_id: z.string(),
  device_id: z.string(),
  boot_id: z.string(),
  device_mode: HardwareEndpointModeEnum,
  protocol_version: z.string(),
  firmware_version: z.string(),
  connected_at: z.string(),
  disconnected_at: z.string().nullable().optional(),
  status: z.string().default("ACTIVE"),
  sequence_base: z.number().int().nonnegative().default(0),
});
export type HardwareSession = z.infer<typeof HardwareSessionSchema>;

// ============================================================================
// Diagnostics & Fault Perturbations
// ============================================================================

export const HardwareDiagnosticSchema = z.object({
  diag_id: z.string(),
  device_id: z.string(),
  session_id: z.string().nullable().optional(),
  category: z.string(),
  severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]).default("INFO"),
  message: z.string(),
  timestamp: z.string(),
  details: z.record(z.any()).optional(),
});
export type HardwareDiagnostic = z.infer<typeof HardwareDiagnosticSchema>;

export const HardwareFaultSchema = z.object({
  fault_type: z.enum([
    "SERIAL_DISCONNECT",
    "READ_TIMEOUT",
    "WRITE_TIMEOUT",
    "FRAME_CORRUPT",
    "ACK_LOSS",
    "DEVICE_REBOOT",
    "SEQUENCE_GAP",
    "DUPLICATE_FRAME",
    "DELAYED_RESPONSE",
    "HEARTBEAT_LOSS",
    "CAPABILITY_MISMATCH",
    "PROTOCOL_MISMATCH",
  ]),
  parameters: z.record(z.any()).default({}),
  active: z.boolean().default(false),
});
export type HardwareFault = z.infer<typeof HardwareFaultSchema>;

export const HardwareRecoveryResultSchema = z.object({
  recovery_id: z.string(),
  fault_type: z.string(),
  recovered: z.boolean(),
  old_session_id: z.string().nullable().optional(),
  new_session_id: z.string().nullable().optional(),
  renegotiated: z.boolean(),
  reconciled: z.boolean(),
  stale_commands_invalidated: z.number().int().nonnegative().default(0),
  rtt_ms: z.number().nullable().optional(),
  timestamp: z.string(),
});
export type HardwareRecoveryResult = z.infer<typeof HardwareRecoveryResultSchema>;

// ============================================================================
// HIL Experiments & Canonical Scenario Results
// ============================================================================

export const HILExperimentSchema = z.object({
  experiment_id: z.string(),
  scenario_id: z.string(),
  name: z.string(),
  device_mode: HardwareEndpointModeEnum,
  device_id: z.string(),
  firmware_version: z.string(),
  protocol_version: z.string(),
  seed: z.number().nullable().optional(),
  manifest_hash: z.string(),
  passed: z.boolean(),
  verdict: z.string(),
  started_at: z.string(),
  completed_at: z.string(),
  details: z.record(z.any()).optional(),
});
export type HILExperiment = z.infer<typeof HILExperimentSchema>;

export const HILScenarioResultSchema = z.object({
  scenario_id: z.string(),
  name: z.string(),
  description: z.string(),
  passed: z.boolean(),
  observed_ack_status: z.string().nullable().optional(),
  transmission_count: z.number().int().nonnegative().default(0),
  ack_count: z.number().int().nonnegative().default(0),
  nack_count: z.number().int().nonnegative().default(0),
  latency_ms: z.number().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  timestamp: z.string(),
});
export type HILScenarioResult = z.infer<typeof HILScenarioResultSchema>;
