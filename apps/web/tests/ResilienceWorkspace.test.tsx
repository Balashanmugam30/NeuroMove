import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResilienceStatusCard } from "../components/resilience/ResilienceStatusCard";
import { ActiveFaultsPanel } from "../components/resilience/ActiveFaultsPanel";
import { ExperimentRunner } from "../components/resilience/ExperimentRunner";
import { ExperimentTimeline } from "../components/resilience/ExperimentTimeline";
import { InvariantMatrixTable } from "../components/resilience/InvariantMatrixTable";
import { RecoveryDiagnosticsCard } from "../components/resilience/RecoveryDiagnosticsCard";
import { ReplayComparisonPanel } from "../components/resilience/ReplayComparisonPanel";
import {
  ResilienceLabStatus,
  FaultDefinition,
  InvariantResult,
  RecoveryCheckpoint,
  FaultExperiment,
  FailureScenarioResult,
} from "@neuromove/contracts";

const mockStatus: ResilienceLabStatus = {
  lab_mode: "IDLE",
  active_faults: [],
  pipeline_health: {
    transport_healthy: true,
    confidence_healthy: true,
    intent_healthy: true,
    safety_healthy: true,
    database_healthy: true,
    active_model_healthy: true,
    active_faults_count: 0,
    current_safety_state: "SAFE_IDLE",
    current_safety_decision: "DENIED",
    current_intent_state: null,
    timestamp: new Date().toISOString(),
  },
  metrics: {
    total_experiments: 10,
    active_faults_count: 0,
    total_faults_injected: 25,
    accidental_authorizations: 0,
    fail_closed_certifications: 10,
    total_invariants_checked: 140,
    invariants_passed: 140,
    invariants_failed: 0,
    mean_recovery_time_ms: 12.4,
    clean_recoveries: 10,
    restrictive_recoveries: 0,
    failed_recoveries: 0,
    critical_data_losses: 0,
  },
  registered_scenarios_count: 34,
};

const mockFault: FaultDefinition = {
  fault_id: "flt_test_01",
  fault_type: "STREAM_DELAY",
  category: "TRANSPORT",
  severity: "MEDIUM",
  scope: "SINGLE_EVENT",
  parameters: {
    delay_ms: 500,
  },
  status: "ACTIVE",
  injected_at: new Date().toISOString(),
  cleared_at: null,
  duration_ms: null,
  trigger_type: "MANUAL",
  description: "Test delay injection",
};

const mockInvariant: InvariantResult = {
  invariant_id: "INV_01_NO_ACCIDENTAL_AUTHORIZATION",
  name: "No Accidental Authorization Under Fault",
  severity: "CRITICAL",
  status: "PASS",
  observed_value: "false",
  expected_value: "false",
  evidence: { authorization_during_fault: false },
  timestamp: new Date().toISOString(),
};

const mockCheckpoint: RecoveryCheckpoint = {
  checkpoint_id: "chk_test_01",
  component: "safety_gate",
  last_known_safe_state: "SAFE_IDLE",
  sequence_number: 1,
  checksum: "abc123def456",
  timestamp: new Date().toISOString(),
};

const mockExperiment: FaultExperiment = {
  experiment_id: "exp_test_01",
  name: "Stream Disconnect Verification",
  manifest: {
    manifest_id: "man_01",
    name: "Stream Disconnect Verification",
    seed: 42,
    fault_sequence: [mockFault],
    expected_safety_decision: "DENIED",
    expected_safety_state: "DENIED",
    manifest_checksum: "manifest123hash",
    created_at: new Date().toISOString(),
  },
  seed: 42,
  baseline_snapshot: mockStatus.pipeline_health,
  status: "COMPLETED",
  authorization_before_failure: true,
  authorization_during_failure: false,
  authorization_after_failure: false,
  invariants: [mockInvariant],
  recovery_status: "RECOVERED_CLEANLY",
  data_loss_status: "NONE",
  final_snapshot: mockStatus.pipeline_health,
  steps_audit: [
    { step: 1, action: "Captured baseline" },
    { step: 2, action: "Injected fault" },
  ],
  duration_ms: 15.2,
  created_at: new Date().toISOString(),
};

describe("Phase 18 Resilience Laboratory Components", () => {
  it("renders ResilienceStatusCard with healthy KPIs and Phase 18 badge", () => {
    const onReset = vi.fn();
    render(<ResilienceStatusCard status={mockStatus} onResetLab={onReset} />);

    expect(screen.getByText("Resilience & Fault Laboratory")).toBeDefined();
    expect(screen.getByText("Phase 18")).toBeDefined();
    expect(screen.getByText("IDLE")).toBeDefined();
    expect(screen.getByText("Fail-Closed Certifications")).toBeDefined();
    expect(screen.getByText("Invariant #1 Strictly Preserved")).toBeDefined();

    const resetBtn = screen.getByRole("button", { name: /Emergency Lab Reset/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders ActiveFaultsPanel and triggers inject and clear callbacks", () => {
    const onInject = vi.fn();
    const onClear = vi.fn();
    render(
      <ActiveFaultsPanel
        faults={[mockFault]}
        onInject={onInject}
        onClear={onClear}
      />
    );

    expect(screen.getByText("Active Fault Registry")).toBeDefined();
    expect(screen.getByText("STREAM_DELAY")).toBeDefined();
    expect(screen.getByText("flt_test_01")).toBeDefined();

    const clearBtn = screen.getByRole("button", { name: /Clear/i });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledWith("flt_test_01");

    // Open injection form
    const openBtn = screen.getByRole("button", { name: /Inject Controlled Fault/i });
    fireEvent.click(openBtn);
    expect(screen.getByText("Configure Parameterized Fault")).toBeDefined();
  });

  it("renders ExperimentRunner and lists canonical scenarios", () => {
    const onRun = vi.fn().mockResolvedValue({
      scenario_id: "SCENARIO_A",
      name: "Stream Disconnect",
      category: "TRANSPORT",
      description: "Realtime drop",
      passed: true,
      fail_closed_certified: true,
      expected_safety_decision: "DENIED",
      observed_safety_decision: "DENIED",
      expected_safety_state: "DENIED",
      observed_safety_state: "DENIED",
      recovery_status: "RECOVERED_CLEANLY",
      experiment_id: "exp_test_01",
      steps_audit: [],
      replay_hash: "rep_123",
    });

    render(<ExperimentRunner onRunScenario={onRun} />);
    expect(screen.getByText("Failure Scenario Verification Laboratory")).toBeDefined();
    expect(screen.getByText("SCENARIO_A")).toBeDefined();
    expect(screen.getByText("SCENARIO_B")).toBeDefined();

    const runBtns = screen.getAllByRole("button", { name: /Run/i });
    fireEvent.click(runBtns[0]);
    expect(onRun).toHaveBeenCalled();
  });

  it("renders InvariantMatrixTable with 14 invariants support and evidence expansion", () => {
    render(<InvariantMatrixTable invariants={[mockInvariant]} />);
    expect(screen.getByText("Formal Platform Invariants Matrix")).toBeDefined();
    expect(screen.getByText("No Accidental Authorization Under Fault")).toBeDefined();
    expect(screen.getByText("INV_01_NO_ACCIDENTAL_AUTHORIZATION")).toBeDefined();
    expect(screen.getByText("PASS")).toBeDefined();

    // Toggle expand row
    const row = screen.getByText("No Accidental Authorization Under Fault");
    fireEvent.click(row);
    expect(screen.getByText(/Cryptographic Evidence/i)).toBeDefined();
  });

  it("renders RecoveryDiagnosticsCard and Checkpoints", () => {
    render(
      <RecoveryDiagnosticsCard
        checkpoints={[mockCheckpoint]}
        latestRecoveryStatus="RECOVERED_CLEANLY"
        dataLossStatus="NONE"
      />
    );

    expect(screen.getByText("Deterministic Recovery & Checkpoints")).toBeDefined();
    expect(screen.getByText("chk_test_01")).toBeDefined();
    expect(screen.getByText("safety_gate")).toBeDefined();
    expect(screen.getByText("abc123def456")).toBeDefined();
  });

  it("renders ReplayComparisonPanel and triggers replay", async () => {
    const onReplay = vi.fn().mockResolvedValue({
      experiment_id: "exp_test_01",
      deterministic_parity: true,
      manifest_checksum: "manifest123hash",
      original_status: "COMPLETED",
    });

    render(<ReplayComparisonPanel experiments={[mockExperiment]} onReplay={onReplay} />);
    expect(screen.getByText("Deterministic Replay Engine")).toBeDefined();

    const replayBtn = screen.getByRole("button", { name: /Replay Experiment/i });
    fireEvent.click(replayBtn);
    expect(onReplay).toHaveBeenCalledWith("exp_test_01");
  });

  it("renders ExperimentTimeline with 5 audit steps", () => {
    render(<ExperimentTimeline experiment={mockExperiment} />);
    expect(screen.getByText("Execution Audit Timeline")).toBeDefined();
    expect(screen.getByText("Baseline Checkpoint Captured")).toBeDefined();
    expect(screen.getByText("Controlled Fault Injected")).toBeDefined();
    expect(screen.getByText("Safety Gate Evaluation Under Fault")).toBeDefined();
    expect(screen.getByText("Platform Invariant Verification")).toBeDefined();
    expect(screen.getByText("Conservative Recovery Certification")).toBeDefined();
  });
});
