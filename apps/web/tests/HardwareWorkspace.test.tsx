import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeviceOverviewCard } from "../components/hardware/DeviceOverviewCard";
import { ConnectionNegotiationPanel } from "../components/hardware/ConnectionNegotiationPanel";
import { CommandVerificationConsole } from "../components/hardware/CommandVerificationConsole";
import { HILExperimentLab } from "../components/hardware/HILExperimentLab";
import { HardwareTraceViewer } from "../components/hardware/HardwareTraceViewer";
import { RecoveryDiagnosticsPanel } from "../components/hardware/RecoveryDiagnosticsPanel";
import {
  HardwareStatus,
  SerialPortDescriptor,
  CommandTrace,
} from "@neuromove/contracts";

const mockHardwareStatus: HardwareStatus = {
  connection_state: "READY",
  active_mode: "SIMULATOR",
  device: {
    device_id: "esp32_sim_01",
    device_type: "ESP32_SIMULATOR",
    device_mode: "SIMULATOR",
    firmware_version: "esp32-neuromove-v0.1.0",
    firmware_build: "bld_20260901_sim",
    protocol_version: "1.0",
    boot_id: "boot_test_01",
    hardware_revision: "ESP32-DevKitC-v4",
    capabilities: [
      "COMMAND_RECEIVE",
      "COMMAND_ACK",
      "COMMAND_NACK",
      "HEARTBEAT",
      "STATUS_REPORT",
      "SAFE_STOP",
      "SIMULATION",
    ],
    uptime_ms: 12000,
    hashed_serial_identifier: "hash_esp32_01",
    last_seen: new Date().toISOString(),
  },
  firmware: {
    firmware_name: "esp32-neuromove-hil",
    firmware_version: "0.1.0",
    build_hash: "bld_20260901_sim",
    compiled_at: new Date().toISOString(),
    target_mcu: "ESP32-S3",
    is_hil_only: true,
  },
  session_id: "sess_hw_01",
  boot_id: "boot_test_01",
  heartbeat: {
    last_sent: new Date().toISOString(),
    last_received: new Date().toISOString(),
    round_trip_time_ms: 2.5,
    missed_count: 0,
    link_state: "CONNECTED",
  },
  health: {
    link_state: "READY",
    application_healthy: true,
    device_connected: true,
    device_ready: true,
    heartbeat_healthy: true,
    command_channel_healthy: true,
    round_trip_time_ms: 2.5,
    missed_heartbeats: 0,
  },
  metrics: {
    commands_sent: 15,
    commands_acknowledged: 15,
    commands_rejected: 0,
    commands_duplicated: 1,
    commands_expired: 0,
    retries_total: 0,
    timeouts_total: 0,
    checksum_failures: 0,
    sequence_gaps: 0,
    sequence_duplicates: 0,
    heartbeat_failures: 0,
    reconnections: 0,
    average_rtt_ms: 2.5,
    p95_rtt_ms: 3.1,
  },
  simulated_mode: true,
  updated_at: new Date().toISOString(),
};

const mockPorts: SerialPortDescriptor[] = [
  {
    port: "VIRTUAL_COM_01",
    description: "Virtual Serial Loopback Pair",
    manufacturer: "NeuroMove",
    is_open: false,
    baud_rate: 115200,
  },
  {
    port: "SIMULATED_ENDPOINT",
    description: "In-Memory ESP32 Simulator",
    is_open: true,
    baud_rate: 115200,
  },
];

const mockTraces: CommandTrace[] = [
  {
    trace_id: "tr_01",
    device_id: "esp32_sim_01",
    message_id: "msg_01",
    timestamp: new Date().toISOString(),
    direction: "TX",
    message_type: "COMMAND",
    command_id: "cmd_01",
    sequence_number: 1,
    length_bytes: 64,
    checksum: "ABCD1234",
    decode_status: "VALID",
    latency_ms: 2.5,
  },
  {
    trace_id: "tr_02",
    device_id: "esp32_sim_01",
    message_id: "msg_02",
    timestamp: new Date().toISOString(),
    direction: "RX",
    message_type: "ACK",
    command_id: "cmd_01",
    sequence_number: 1,
    length_bytes: 32,
    checksum: "EFGH5678",
    decode_status: "VALID",
    latency_ms: 2.5,
  },
];

describe("Phase 20 Hardware-in-the-Loop Components", () => {
  it("renders DeviceOverviewCard with non-actuation guarantee", () => {
    render(<DeviceOverviewCard status={mockHardwareStatus} />);
    expect(screen.getByText("Hardware & Endpoint Architecture")).toBeDefined();
    expect(screen.getByText("READY")).toBeDefined();
    expect(screen.getByText(/HIL ONLY — Strict Non-Actuation Boundary/i)).toBeDefined();
    expect(screen.getByText("esp32_sim_01")).toBeDefined();
    expect(screen.getByText("boot_test_01")).toBeDefined();
    expect(screen.getByText("2.5 ms")).toBeDefined();
  });

  it("renders ConnectionNegotiationPanel and handles mode switching", () => {
    const handleConnect = vi.fn();
    const handleDisconnect = vi.fn();
    const handleNegotiate = vi.fn();
    const handleDiscover = vi.fn();

    render(
      <ConnectionNegotiationPanel
        status={mockHardwareStatus}
        ports={mockPorts}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onNegotiate={handleNegotiate}
        onDiscoverPorts={handleDiscover}
      />
    );

    expect(screen.getByText("Connection & Protocol Negotiation")).toBeDefined();
    expect(screen.getByText("Simulator (In-Memory)")).toBeDefined();
    expect(screen.getByText("Virtual Serial (CI)")).toBeDefined();
    expect(screen.getByText("Physical ESP32")).toBeDefined();
    expect(screen.getByText("Negotiate Protocol (v1.0)")).toBeDefined();

    fireEvent.click(screen.getByText("Scan Ports"));
    expect(handleDiscover).toHaveBeenCalled();
  });

  it("renders CommandVerificationConsole with safety gating", () => {
    const handleValidate = vi.fn().mockResolvedValue({
      valid: true,
      reason_code: "AUTHORIZED",
      message: "Valid authorization",
      will_transmit: true,
    });
    const handleRunCommand = vi.fn().mockResolvedValue({
      status: "COMMAND_ACCEPTED",
      transmission_count: 1,
      command_id: "cmd_01",
    });

    render(
      <CommandVerificationConsole
        status={mockHardwareStatus}
        onValidate={handleValidate}
        onRunCommand={handleRunCommand}
      />
    );

    expect(screen.getByText("HIL Command Pipeline & Authorization Gate")).toBeDefined();
    expect(screen.getByText("Pre-Flight Safety Validation")).toBeDefined();
    expect(screen.getByText("Transmit HIL Command")).toBeDefined();

    fireEvent.click(screen.getByText("Pre-Flight Safety Validation"));
    expect(handleValidate).toHaveBeenCalled();
  });

  it("renders HILExperimentLab and lists canonical scenarios", () => {
    const handleRunScenario = vi.fn().mockResolvedValue({
      scenario_id: "SCENARIO_A",
      name: "Device Discovery",
      description: "Safe enumeration",
      passed: true,
      observed_ack_status: "SUCCESS",
      transmission_count: 0,
      ack_count: 0,
      nack_count: 0,
      latency_ms: 1.0,
      timestamp: new Date().toISOString(),
    });
    const handleReplay = vi.fn();

    render(
      <HILExperimentLab
        experiments={[]}
        onRunScenario={handleRunScenario}
        onReplayExperiment={handleReplay}
      />
    );

    expect(screen.getByText(/HIL Canonical Verification Matrix/i)).toBeDefined();
    expect(screen.getByText("Run All 20 Scenarios")).toBeDefined();
    expect(screen.getByText("Device Discovery")).toBeDefined();
    expect(screen.getByText("CRC-32 Corruption")).toBeDefined();
    expect(screen.getByText("Full E2E HIL Recovery")).toBeDefined();
  });

  it("renders HardwareTraceViewer with TX and RX frames", () => {
    render(<HardwareTraceViewer traces={mockTraces} />);
    expect(screen.getByText("Real-Time Hardware Protocol Trace")).toBeDefined();
    expect(screen.getByText("2 frames")).toBeDefined();
    expect(screen.getByText("COMMAND")).toBeDefined();
    expect(screen.getByText("ACK")).toBeDefined();
  });

  it("renders RecoveryDiagnosticsPanel with heartbeat telemetry", () => {
    const handlePing = vi.fn();
    const handleReboot = vi.fn();
    const handleReconnect = vi.fn();
    const handleReset = vi.fn();

    render(
      <RecoveryDiagnosticsPanel
        status={mockHardwareStatus}
        diagnostics={[]}
        onPingHeartbeat={handlePing}
        onRebootDevice={handleReboot}
        onReconnect={handleReconnect}
        onResetLab={handleReset}
      />
    );

    expect(screen.getByText("Recovery, Diagnostics & Link Health")).toBeDefined();
    expect(screen.getByText("0 MISSED PINGS")).toBeDefined();
    expect(screen.getByText("Send Heartbeat Ping")).toBeDefined();
    expect(screen.getByText("Cold Reboot Endpoint")).toBeDefined();

    fireEvent.click(screen.getByText("Send Heartbeat Ping"));
    expect(handlePing).toHaveBeenCalled();
  });
});
