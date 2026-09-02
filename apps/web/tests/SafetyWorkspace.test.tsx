import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrentSafetyCard } from "../components/safety/CurrentSafetyCard";
import { SafetyRuleMatrixTable } from "../components/safety/SafetyRuleMatrixTable";
import { SafetyTimeline } from "../components/safety/SafetyTimeline";
import { SafetyHistoryTable } from "../components/safety/SafetyHistoryTable";
import { SafetyPolicyEditor } from "../components/safety/SafetyPolicyEditor";
import { SafetySimulationLab } from "../components/safety/SafetySimulationLab";
import {
  SafetyStateSnapshot,
  SafetyEvaluation,
  SafetyTransition,
  SafetyPolicy,
} from "@neuromove/contracts";

const mockSnapshot: SafetyStateSnapshot = {
  snapshot_id: "snap_test_01",
  current_state: "SAFE_IDLE",
  last_decision: "DENIED",
  active_intent_id: "int_test_123",
  intent_class: "LEFT",
  primary_reason: "Safe idle default state.",
  active_policy_version: "1.0.0",
  emergency_stop: false,
  emergency_stop_reason: null,
  operator_hold: false,
  operator_id: null,
  lockout: false,
  lockout_reason: null,
  system_healthy: true,
  stream_healthy: true,
  last_evaluation_id: "eval_test_01",
  state_deadline: null,
  transition_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockEvaluation: SafetyEvaluation = {
  evaluation_id: "eval_test_01",
  decision: "AUTHORIZED",
  state: "AUTHORIZED",
  primary_reason: "All configured software safety constraints pass.",
  precedence_rank: 9,
  all_reasons: [],
  violated_rules: [],
  passed_rules: [
    {
      rule_id: "RULE_01_EMERGENCY_STOP",
      category: "EMERGENCY_STOP",
      status: "PASS",
      severity: "INFO",
      reason_code: "E_STOP_CLEAR",
      message: "Emergency stop is not active.",
      evidence: {},
      evaluated_at: new Date().toISOString(),
    },
  ],
  policy_version: "1.0.0",
  intent_id: "int_test_123",
  intent_class: "LEFT",
  subject_id: "sub-01",
  session_id: "sess-01",
  model_version_id: "model_v1",
  confidence_score: 0.92,
  confidence_evaluation_id: "conf_01",
  temporal_confirmation_id: "tc_01",
  evaluated_at: new Date().toISOString(),
  duration_ms: 0.12,
};

const mockTransition: SafetyTransition = {
  transition_id: "trans_test_01",
  sequence_number: 1,
  previous_state: "SAFE_IDLE",
  next_state: "EVALUATING",
  trigger_name: "EVALUATION_START",
  reason: "Candidate intent evaluation initiated.",
  evaluation_id: "eval_test_01",
  intent_id: "int_test_123",
  policy_version: "1.0.0",
  timestamp: new Date().toISOString(),
};

const mockPolicy: SafetyPolicy = {
  policy_id: "pol_test_01",
  version: "1.0.0",
  allowlisted_intents: ["LEFT", "RIGHT", "FORWARD", "BACKWARD"],
  blocked_intents: ["REST", "STOP", "NONE", "UNCERTAIN"],
  max_intent_age_ms: 500.0,
  max_evaluation_age_ms: 300.0,
  max_context_age_ms: 1000.0,
  max_authorized_duration_ms: 2000.0,
  maximum_command_rate: 5,
  rate_window_ms: 1000.0,
  minimum_command_gap_ms: 100.0,
  critical_health_requirements: ["backend", "database"],
  operator_hold_enabled: true,
  emergency_stop_enabled: true,
  lockout_threshold: 3,
  lockout_policy: "REQUIRE_MANUAL_RESET",
  reset_requirements: ["HEALTH_OK", "NO_E_STOP"],
  created_at: new Date().toISOString(),
  checksum: "a1b2c3d4e5f60718",
};

describe("CurrentSafetyCard", () => {
  it("renders snapshot state and triggers emergency stop", () => {
    const onEStop = vi.fn().mockResolvedValue(undefined);
    render(
      <CurrentSafetyCard
        snapshot={mockSnapshot}
        onEmergencyStop={onEStop}
        onClearEmergencyStop={vi.fn()}
        onToggleHold={vi.fn()}
        onReset={vi.fn()}
        onLockout={vi.fn()}
        onUnlock={vi.fn()}
      />
    );

    expect(screen.getByText("SAFE_IDLE")).toBeInTheDocument();
    expect(screen.getByText("Execution Denied")).toBeInTheDocument();

    const stopButton = screen.getByText("EMERGENCY STOP");
    fireEvent.click(stopButton);
    expect(onEStop).toHaveBeenCalled();
  });
});

describe("SafetyRuleMatrixTable", () => {
  it("renders the 13 safety rules and evaluation status", () => {
    render(<SafetyRuleMatrixTable evaluation={mockEvaluation} />);
    expect(screen.getByText("Deterministic Safety Rule Matrix")).toBeInTheDocument();
    expect(screen.getByText("RULE_01_EMERGENCY_STOP")).toBeInTheDocument();
    expect(screen.getByText("RULE_12_RATE_LIMIT")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });
});

describe("SafetyTimeline", () => {
  it("renders transition records", () => {
    render(<SafetyTimeline transitions={[mockTransition]} />);
    expect(screen.getByText("Safety State Transition Audit Log")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("[EVALUATION_START]")).toBeInTheDocument();
  });
});

describe("SafetyHistoryTable", () => {
  it("renders evaluation history rows and filters", () => {
    render(<SafetyHistoryTable evaluations={[mockEvaluation]} />);
    expect(screen.getByText("Safety Evaluation History")).toBeInTheDocument();
    expect(screen.getByText("eval_test_01")).toBeInTheDocument();
    expect(screen.getAllByText("AUTHORIZED").length).toBeGreaterThanOrEqual(1);
  });
});

describe("SafetyPolicyEditor", () => {
  it("renders policy fields and handles save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SafetyPolicyEditor policy={mockPolicy} onSavePolicy={onSave} />);

    expect(screen.getByText("Safety Policy Parameters")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();

    const saveButton = screen.getByText("Save Policy");
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalled();
  });
});

describe("SafetySimulationLab", () => {
  it("renders all scenarios and triggers scenario run", () => {
    const onRun = vi.fn().mockResolvedValue({
      scenario_id: "SCENARIO_A",
      name: "Fully Valid Active Intent",
      description: "Test description",
      expected_decision: "AUTHORIZED",
      actual_decision: "AUTHORIZED",
      expected_state: "AUTHORIZED",
      actual_state: "AUTHORIZED",
      passed: true,
      steps_audit: [],
    });

    render(<SafetySimulationLab onRunScenario={onRun} />);
    expect(screen.getByText("Safety Simulation & Invariant Laboratory")).toBeInTheDocument();
    expect(screen.getByText("Scenario A — Fully Valid Intent")).toBeInTheDocument();
    expect(screen.getByText("Run All 15 Scenarios")).toBeInTheDocument();

    const runButtons = screen.getAllByText("Run Scenario");
    fireEvent.click(runButtons[0]);
    expect(onRun).toHaveBeenCalledWith("SCENARIO_A");
  });
});
