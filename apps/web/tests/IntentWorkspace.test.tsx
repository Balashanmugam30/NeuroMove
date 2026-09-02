import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrentIntentCard } from "../components/intent/CurrentIntentCard";
import { IntentLifecycleTimeline } from "../components/intent/IntentLifecycleTimeline";
import { TransitionExplanationPanel } from "../components/intent/TransitionExplanationPanel";
import { IntentHistoryTable } from "../components/intent/IntentHistoryTable";
import { IntentPolicyEditor } from "../components/intent/IntentPolicyEditor";
import { IntentSimulationLab } from "../components/intent/IntentSimulationLab";
import {
  IntentStateSnapshot,
  IntentRecord,
  IntentStateTransition,
  IntentPolicy,
} from "@neuromove/contracts";

const mockSnapshot: IntentStateSnapshot = {
  snapshot_id: "current_authoritative_snapshot",
  active_intent_id: "int_test_12345",
  current_state: "ACTIVE",
  intent_class: "LEFT_IMAGERY",
  subject_id: "sub-001",
  session_id: "ses-001",
  model_version_id: "v1",
  confidence_score: 0.92,
  confidence_evaluation_id: "eval_01",
  temporal_confirmation_id: "conf_01",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  state_deadline: 1002.0,
  transition_reason: "TEMPORAL_CONFIRMATION_ACCEPTED",
  policy_version: "v1.0.0",
  transition_count: 3,
};

const mockRecord: IntentRecord = {
  intent_id: "int_test_12345",
  intent_class: "LEFT_IMAGERY",
  current_state: "ACTIVE",
  subject_id: "sub-001",
  session_id: "ses-001",
  model_version_id: "v1",
  confidence_score: 0.92,
  confidence_band: "HIGH",
  eligibility: "VALID",
  source_event_id: "evt_001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  state_deadline: 1002.0,
  is_terminal: false,
  policy_version: "v1.0.0",
};

const mockTransition: IntentStateTransition = {
  transition_id: "tr_test_01",
  sequence_number: 1,
  intent_id: "int_test_12345",
  intent_class: "LEFT_IMAGERY",
  previous_state: "CONFIRMED",
  next_state: "ACTIVE",
  trigger: "ACCEPT_ACTIVE",
  reason: "TEMPORAL_CONFIRMATION_ACCEPTED",
  subject_id: "sub-001",
  session_id: "ses-001",
  model_version_id: "v1",
  confidence_score: 0.92,
  policy_version: "v1.0.0",
  timestamp: new Date().toISOString(),
  details: "Intent LEFT_IMAGERY activated",
};

const mockPolicy: IntentPolicy = {
  policy_id: "default_intent_policy",
  version: "v1.0.0",
  candidate_timeout_ms: 1000.0,
  confirmation_acceptance_window_ms: 500.0,
  active_intent_timeout_ms: 2000.0,
  allow_replacement: true,
  replacement_requires_confirmation: true,
  same_class_reconfirmation_cooldown_ms: 1000.0,
  cross_class_replacement_policy: "REQUIRE_CONFIRMATION",
  subject_change_policy: "INTERRUPT_AND_RESET",
  session_change_policy: "INTERRUPT_AND_RESET",
  model_change_policy: "INTERRUPT_AND_RESET",
  rest_handling_policy: "CANCEL_CANDIDATE",
  parameters: {},
  created_at: new Date().toISOString(),
  checksum: "abc1234567890",
};

describe("Intent State Machine & Lifecycle UI Components", () => {
  it("renders CurrentIntentCard with active state and metrics", () => {
    const handleComplete = vi.fn();
    const handleCancel = vi.fn();
    render(
      <CurrentIntentCard
        snapshot={mockSnapshot}
        currentIntent={mockRecord}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
    expect(screen.getByText("Authoritative Intent State")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE INTENT")).toBeInTheDocument();
    expect(screen.getByText("LEFT_IMAGERY")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Safety Arbitration")).toBeInTheDocument();

    const completeBtn = screen.getByText("Mark Completed");
    fireEvent.click(completeBtn);
    expect(handleComplete).toHaveBeenCalledTimes(1);
  });

  it("renders IntentLifecycleTimeline highlighting current active position", () => {
    render(<IntentLifecycleTimeline currentState="ACTIVE" />);
    expect(screen.getByText("Canonical Lifecycle Timeline")).toBeInTheDocument();
    expect(screen.getByText("Active Intent")).toBeInTheDocument();
    expect(screen.getByText("Current Position")).toBeInTheDocument();
  });

  it("renders TransitionExplanationPanel with audit breakdown and handoff preview", () => {
    render(
      <TransitionExplanationPanel
        snapshot={mockSnapshot}
        lastTransition={mockTransition}
      />
    );
    expect(screen.getByText("Transition Explanation & Audit Breakdown")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText("ACCEPT_ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("Phase 17 Safety Arbitration Handoff Contract")).toBeInTheDocument();
  });

  it("renders IntentHistoryTable with transitions and filter controls", () => {
    render(
      <IntentHistoryTable
        transitions={[mockTransition]}
        records={[mockRecord]}
      />
    );
    expect(screen.getByText("Intent History & Transition Audit Log")).toBeInTheDocument();
    expect(screen.getByText("ACCEPT_ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders IntentPolicyEditor and triggers save", async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<IntentPolicyEditor policy={mockPolicy} onSave={handleSave} />);
    expect(screen.getByText("Lifecycle Policy Configuration")).toBeInTheDocument();
    expect(screen.getAllByText("1000 ms").length).toBeGreaterThan(0);

    const saveBtn = screen.getByText("Save Policy");

    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalled();
  });

  it("renders IntentSimulationLab with scenarios A through L", async () => {
    const handleRun = vi.fn().mockResolvedValue({
      scenario_id: "SCENARIO_A_NORMAL_LIFECYCLE",
      executed_at: new Date().toISOString(),
      passed: true,
      results: [
        {
          step: 1,
          action: "Step 1",
          previous_state: "NO_INTENT",
          next_state: "CANDIDATE",
          reason: "CANDIDATE_CREATED",
        },
      ],
      final_snapshot: mockSnapshot,
    });

    render(<IntentSimulationLab onRunScenario={handleRun} />);
    expect(screen.getByText("Deterministic Intent Lifecycle Lab")).toBeInTheDocument();
    expect(screen.getByText("Scenario A: Normal Lifecycle")).toBeInTheDocument();
    expect(screen.getByText("Scenario B: Candidate Timeout")).toBeInTheDocument();
    expect(screen.getByText("Scenario E: Session Boundary")).toBeInTheDocument();
    expect(screen.getByText("Scenario I: Cross-Class Replacement")).toBeInTheDocument();
  });
});
