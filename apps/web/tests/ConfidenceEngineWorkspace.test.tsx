import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveConfidenceCard } from "../components/confidence/LiveConfidenceCard";
import { TemporalEvidencePanel } from "../components/confidence/TemporalEvidencePanel";
import { DecisionExplanationView } from "../components/confidence/DecisionExplanationView";
import { ConfidenceHistoryTable } from "../components/confidence/ConfidenceHistoryTable";
import { CalibrationDiagnosticsPanel } from "../components/confidence/CalibrationDiagnosticsPanel";
import { ConfidenceConfigEditor } from "../components/confidence/ConfidenceConfigEditor";
import { SimulationScenarioRunner } from "../components/confidence/SimulationScenarioRunner";
import {
  ConfidenceConfig,
  ConfidenceDecision,
  TemporalConfirmationDecision,
  Phase16IntentHandoffPayload,
  TemporalConfirmationState,
  ConfidenceHistoryRecord,
  CalibrationMetrics,
  ConfidenceCalibrationProfile,
} from "@neuromove/contracts";

const mockConfig: ConfidenceConfig = {
  config_id: "cfg_test_01",
  version: "v1.0.0",
  scope: "GLOBAL",
  subject_id: null,
  model_version_id: null,
  high_threshold: 0.75,
  medium_threshold: 0.55,
  min_eligible_confidence: 0.40,
  min_consecutive_windows: 3,
  min_duration_ms: 500.0,
  max_gap_ms: 500.0,
  cooldown_ms: 1000.0,
  refractory_ms: 500.0,
  hysteresis_enter: 0.75,
  hysteresis_exit: 0.60,
  max_age_ms: 400.0,
  quality_floor: 0.50,
  allow_same_class_reconfirmation: false,
  parameters: {},
  created_at: new Date().toISOString(),
  checksum: "abcdef1234567890",
};

const mockDecision: ConfidenceDecision = {
  decision_id: "dec_test_01",
  prediction: "LEFT_IMAGERY",
  raw_score: 0.92,
  score_type: "PROBABILITY",
  normalized_score: 0.92,
  calibrated_confidence: 0.88,
  confidence_band: "HIGH",
  eligibility: "VALID",
  class_margin: 0.76,
  runner_up_class: "RIGHT_IMAGERY",
  signal_quality: 0.95,
  freshness: "FRESH",
  model_validity: "ACTIVE",
  components: {
    model_score_component: 0.92,
    class_margin_component: 0.76,
    signal_quality_component: 0.95,
    freshness_component: 1.0,
    model_validity_component: 1.0,
    calibration_component: 1.0,
  },
  decision_reason: "Prediction 'LEFT_IMAGERY' verified valid with HIGH confidence (88.0%).",
  timestamp: 1000.0,
  model_version_id: "v1",
  subject_id: "sub-001",
  session_id: "ses-001",
};

const mockTemporalDecision: TemporalConfirmationDecision = {
  temporally_confirmed: true,
  confirmed_prediction: "LEFT_IMAGERY",
  confidence: 0.88,
  confidence_band: "HIGH",
  eligibility: "VALID",
  temporal_status: "CONFIRMED",
  consecutive_count: 3,
  accumulated_duration_ms: 750.0,
  required_count: 3,
  required_duration_ms: 500.0,
  confirmation_timestamp: 1000.75,
  decision_reason: "Candidate 'LEFT_IMAGERY' confirmed with 3 consecutive windows (750ms duration) at 88.0% confidence.",
  model_version_id: "v1",
  subject_id: "sub-001",
  session_id: "ses-001",
};

const mockHandoffPayload: Phase16IntentHandoffPayload = {
  prediction: "LEFT_IMAGERY",
  confidence: 0.88,
  confidence_band: "HIGH",
  eligibility: "VALID",
  temporal_status: "CONFIRMED",
  temporally_confirmed: true,
  confirmation_timestamp: 1000.75,
  confirmation_reason: "Confirmed",
  model_version_id: "v1",
  subject_id: "sub-001",
  session_id: "ses-001",
  evidence_window_count: 3,
  evidence_duration_ms: 750.0,
};

const mockTemporalState: TemporalConfirmationState = {
  status: "CONFIRMED",
  current_candidate: "LEFT_IMAGERY",
  candidate_started_at: 1000.0,
  consecutive_count: 3,
  accumulated_duration_ms: 750.0,
  last_evidence_at: 1000.75,
  confirmation_count: 1,
  reset_count: 0,
  cooldown_until: 1001.75,
  refractory_until: 1001.25,
  active_model_version_id: "v1",
  active_subject_id: "sub-001",
  active_session_id: "ses-001",
  last_reset_reason: null,
};

const mockMetrics: CalibrationMetrics = {
  brier_score: 0.042,
  log_loss: 0.125,
  expected_calibration_error: 0.035,
  rejection_rate: 0.15,
  coverage: 0.85,
  precision_at_high_confidence: 0.94,
  reliability_curve: [
    { bin_center: 0.1, empirical_prob: 0.08, mean_confidence: 0.09, count: 12 },
    { bin_center: 0.9, empirical_prob: 0.92, mean_confidence: 0.91, count: 24 },
  ],
};

const mockProfile: ConfidenceCalibrationProfile = {
  calibration_id: "calib_test_01",
  model_version_id: "v1",
  scope: "MODEL",
  subject_id: "sub-001",
  method: "PLATT",
  fit_dataset_reference: "validation_set_alpha",
  parameters: { coef: 1.25, intercept: -0.15 },
  calibration_metrics: mockMetrics,
  status: "ACTIVE",
  checksum: "1234567890abcdef",
  fit_timestamp: new Date().toISOString(),
};

describe("Confidence & Temporal Confirmation Frontend Components", () => {
  it("renders LiveConfidenceCard with prediction and high confidence band", () => {
    render(<LiveConfidenceCard decision={mockDecision} />);
    expect(screen.getByText("Live Prediction Confidence")).toBeInTheDocument();
    expect(screen.getByText("LEFT_IMAGERY")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("High Confidence")).toBeInTheDocument();
  });

  it("renders TemporalEvidencePanel with confirmed state and progress", () => {
    const handleReset = vi.fn();
    render(
      <TemporalEvidencePanel
        temporalDecision={mockTemporalDecision}
        state={mockTemporalState}
        onReset={handleReset}
      />
    );
    expect(screen.getByText("Temporal Confirmation Engine")).toBeInTheDocument();
    expect(screen.getByText("Temporally Confirmed")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    const resetBtn = screen.getByText("Reset State");
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("renders DecisionExplanationView with all six factor components", () => {
    render(
      <DecisionExplanationView
        decision={mockDecision}
        handoffPayload={mockHandoffPayload}
      />
    );
    expect(screen.getByText("Decision Audit & Factor Decomposition")).toBeInTheDocument();
    expect(screen.getByText("Model Calibrated Score")).toBeInTheDocument();
    expect(screen.getByText("Class Margin Separation")).toBeInTheDocument();
    expect(screen.getByText("Electrophysiological Quality")).toBeInTheDocument();
    expect(screen.getByText("Data Freshness Factor")).toBeInTheDocument();
    expect(screen.getByText("Model Operational Validity")).toBeInTheDocument();
    expect(screen.getByText("Calibration Confidence Factor")).toBeInTheDocument();
    expect(screen.getByText("Phase 16 Intent State Machine Handoff Payload")).toBeInTheDocument();
  });

  it("renders ConfidenceHistoryTable with history records and filter", () => {
    const historyItem: ConfidenceHistoryRecord = {
      history_id: "hist_01",
      subject_id: "sub-001",
      session_id: "ses-001",
      model_version_id: "v1",
      predicted_class: "LEFT_IMAGERY",
      confidence: 0.88,
      band: "HIGH",
      eligibility: "VALID",
      temporal_status: "CONFIRMED",
      decision_reason: "Valid high confidence",
      timestamp: new Date().toISOString(),
    };

    render(<ConfidenceHistoryTable history={[historyItem]} />);
    expect(screen.getByText("Telemetry Provenance & Historical Decisions")).toBeInTheDocument();
    expect(screen.getByText("LEFT_IMAGERY")).toBeInTheDocument();
    expect(screen.getByText("88.0%")).toBeInTheDocument();
  });

  it("renders CalibrationDiagnosticsPanel with Brier and ECE scores", () => {
    const handleFit = vi.fn().mockResolvedValue(undefined);
    render(
      <CalibrationDiagnosticsPanel
        metrics={mockMetrics}
        profile={mockProfile}
        onFitCalibration={handleFit}
      />
    );
    expect(screen.getByText("Calibration Diagnostics & Reliability Curves")).toBeInTheDocument();
    expect(screen.getByText("0.0420")).toBeInTheDocument(); // Brier score
    expect(screen.getByText("3.50%")).toBeInTheDocument(); // ECE

    const fitBtn = screen.getByText("Fit Calibration");
    fireEvent.click(fitBtn);
    expect(handleFit).toHaveBeenCalled();
  });

  it("renders ConfidenceConfigEditor and submits updated policy", async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ConfidenceConfigEditor config={mockConfig} onSave={handleSave} />);
    expect(screen.getByText("Confidence & Temporal Policy Configuration")).toBeInTheDocument();

    const saveBtn = screen.getByText("Save Policy");
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalled();
  });

  it("renders SimulationScenarioRunner with Scenarios A through H", async () => {
    const handleRun = vi.fn().mockResolvedValue({
      scenario_id: "SCENARIO_A_STABLE_HIGH_CONFIDENCE",
      executed_at: new Date().toISOString(),
      results: [{ step: 1, prediction: "LEFT", confidence: 0.92, temporal_status: "TRACKING", confirmed: false }],
    });

    render(<SimulationScenarioRunner onRunScenario={handleRun} />);
    expect(screen.getByText("Deterministic Scenario Verification Lab")).toBeInTheDocument();
    expect(screen.getByText("Scenario A: Stable High Confidence")).toBeInTheDocument();
    expect(screen.getByText("Scenario B: Prediction Flicker")).toBeInTheDocument();
    expect(screen.getByText("Scenario C: Poor Signal Quality Rejection")).toBeInTheDocument();
    expect(screen.getByText("Scenario D: Stale Stream Timeout")).toBeInTheDocument();
  });
});
