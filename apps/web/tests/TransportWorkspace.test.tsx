import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkStatusCard } from "../components/transport/LinkStatusCard";
import { CommandConsole } from "../components/transport/CommandConsole";
import { ProtocolTraceViewer } from "../components/transport/ProtocolTraceViewer";
import { ReliabilityMetricsCard } from "../components/transport/ReliabilityMetricsCard";
import { DeviceCapabilitiesPanel } from "../components/transport/DeviceCapabilitiesPanel";
import { TransportSimulationLab } from "../components/transport/TransportSimulationLab";
import {
  TransportLabStatus,
  DeviceIdentity,
  CommandTrace,
  TransportMetrics,
} from "@neuromove/contracts";

const mockStatus: TransportLabStatus = {
  connection_state: "CONNECTED",
  device: {
    device_id: "esp32_sim_01",
    device_type: "ESP32_SIMULATOR",
    firmware_version: "esp32-neuromove-v0.1.0",
    protocol_version: "1.0",
    capabilities: [
      "COMMAND_RECEIVE",
      "COMMAND_ACK",
      "COMMAND_NACK",
      "HEARTBEAT",
      "STATUS_REPORT",
      "SAFE_STOP",
      "SIMULATION",
    ],
    boot_id: "boot_test_01",
    session_id: "sess-01",
  },
  negotiated_capabilities: [
    "COMMAND_RECEIVE",
    "COMMAND_ACK",
    "COMMAND_NACK",
    "HEARTBEAT",
    "STATUS_REPORT",
    "SAFE_STOP",
    "SIMULATION",
  ],
  heartbeat: {
    last_sent: new Date().toISOString(),
    last_received: new Date().toISOString(),
    round_trip_time_ms: 2.5,
    missed_count: 0,
    link_state: "CONNECTED",
  },
  metrics: {
    commands_sent: 10,
    commands_acknowledged: 10,
    commands_rejected: 0,
    commands_duplicated: 2,
    commands_expired: 0,
    retries_total: 1,
    timeouts_total: 0,
    checksum_failures: 0,
    sequence_gaps: 0,
    sequence_duplicates: 0,
    heartbeat_failures: 0,
    reconnections: 1,
    average_rtt_ms: 3.2,
    p95_rtt_ms: 4.8,
  },
  active_commands_count: 0,
  simulated_mode: true,
  updated_at: new Date().toISOString(),
};

const mockTraces: CommandTrace[] = [
  {
    trace_id: "tr_01",
    timestamp: new Date().toISOString(),
    direction: "TX",
    device_id: "esp32_sim_01",
    message_id: "msg_01",
    command_id: "cmd_01",
    sequence_number: 1,
    message_type: "COMMAND",
    length_bytes: 248,
    checksum: "8F3A2B1C",
    decode_status: "VALID",
  },
  {
    trace_id: "tr_02",
    timestamp: new Date().toISOString(),
    direction: "RX",
    device_id: "esp32_sim_01",
    message_id: "msg_ack_01",
    command_id: "cmd_01",
    sequence_number: 1,
    message_type: "ACK",
    length_bytes: 84,
    checksum: "N/A",
    decode_status: "VALID",
    ack_status: "COMMAND_ACCEPTED",
    latency_ms: 2.4,
  },
];

describe("Phase 19: Command Transport & Protocol Workspace Components", () => {
  it("LinkStatusCard renders connection state, endpoint identity, and mandatory simulation disclosure", () => {
    const onReconnect = vi.fn();
    const onPingHeartbeat = vi.fn();

    render(
      <LinkStatusCard
        status={mockStatus}
        onReconnect={onReconnect}
        onPingHeartbeat={onPingHeartbeat}
      />
    );

    // Verify connection badge
    expect(screen.getByText(/CONNECTED \(HEALTHY\)/i)).toBeDefined();

    // Verify simulation disclosure
    expect(screen.getByText(/Simulation Endpoint — No Physical Hardware Connected/i)).toBeDefined();

    // Verify device identity
    expect(screen.getByText("esp32_sim_01")).toBeDefined();
    expect(screen.getByText("v1.0")).toBeDefined();

    // Verify actions
    const pingBtn = screen.getByRole("button", { name: /Ping Heartbeat/i });
    fireEvent.click(pingBtn);
    expect(onPingHeartbeat).toHaveBeenCalledTimes(1);

    const reconnBtn = screen.getByRole("button", { name: /Renegotiate Link/i });
    fireEvent.click(reconnBtn);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("CommandConsole validates upstream safety decision and shows invariant warning on non-authorized decisions", () => {
    const onSend = vi.fn().mockResolvedValue({ status: "ACKED", command_id: "cmd_01" });
    const onCancel = vi.fn();

    render(
      <CommandConsole
        onSendCommand={onSend}
        onCancelCommand={onCancel}
        commands={[]}
      />
    );

    expect(screen.getByText(/Upstream Execution Authorization/i)).toBeDefined();

    // Change safety decision to DENIED
    const selects = screen.getAllByRole("combobox");
    const decisionSelect = selects[1];
    fireEvent.change(decisionSelect, { target: { value: "DENIED" } });

    // Warning banner should be rendered
    expect(screen.getByText(/Invariant 1 dictates zero transport frames will be constructed/i)).toBeDefined();
  });

  it("ProtocolTraceViewer displays packet capture and handles direction filtering", () => {
    render(<ProtocolTraceViewer traces={mockTraces} />);

    expect(screen.getByText("COMMAND")).toBeDefined();
    expect(screen.getByText("ACK")).toBeDefined();
    expect(screen.getByText("8F3A2B1C")).toBeDefined();

    // Click trace to inspect
    const row = screen.getByText("8F3A2B1C");
    fireEvent.click(row);

    // Deep inspector should show details
    expect(screen.getByText(/Frame Deep Inspector/i)).toBeDefined();
  });

  it("ReliabilityMetricsCard renders ACK success rate and diagnostic counts", () => {
    render(<ReliabilityMetricsCard metrics={mockStatus.metrics} />);

    expect(screen.getByText("100%")).toBeDefined();
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3.2 ms")).toBeDefined();
  });

  it("DeviceCapabilitiesPanel renders advertised capabilities matrix", () => {
    const onNeg = vi.fn();
    const onReset = vi.fn();

    render(
      <DeviceCapabilitiesPanel
        device={mockStatus.device}
        onNegotiate={onNeg}
        onResetSimulation={onReset}
      />
    );

    expect(screen.getByText("COMMAND_RECEIVE")).toBeDefined();
    expect(screen.getByText("SAFE_STOP")).toBeDefined();
    expect(screen.getByText("SIMULATION")).toBeDefined();
  });

  it("TransportSimulationLab renders fault toggles and scenario execution buttons", () => {
    const onRun = vi.fn().mockResolvedValue({ passed: true, observed_ack_status: "COMMAND_ACCEPTED" });
    const onInject = vi.fn();
    const onReset = vi.fn();

    const mockScenarios = [
      {
        scenario_id: "SCENARIO_A",
        name: "Normal Handshake & Protocol Negotiation",
        description: "Establish connection, negotiate protocol v1.0, perform heartbeat.",
      },
    ];

    render(
      <TransportSimulationLab
        scenarios={mockScenarios}
        onRunScenario={onRun}
        onInjectFaults={onInject}
        onResetSimulation={onReset}
      />
    );

    expect(screen.getByText(/Drop Next Outgoing Frame/i)).toBeDefined();
    expect(screen.getByText(/Corrupt Checksum \(CRC-32\)/i)).toBeDefined();
    expect(screen.getByText("SCENARIO_A")).toBeDefined();

    const runBtn = screen.getByRole("button", { name: /Execute/i });
    fireEvent.click(runBtn);
    expect(onRun).toHaveBeenCalledWith("SCENARIO_A");
  });
});
