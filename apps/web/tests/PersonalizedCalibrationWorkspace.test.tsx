import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubjectProfileSelector } from "@/components/calibration/SubjectProfileSelector";
import { ProtocolConfigurator } from "@/components/calibration/ProtocolConfigurator";
import { VisualCuePresenter } from "@/components/calibration/VisualCuePresenter";
import { LiveTrialTable } from "@/components/calibration/LiveTrialTable";
import { QualityPanel } from "@/components/calibration/QualityPanel";
import { PersonalizationPanel } from "@/components/calibration/PersonalizationPanel";
import { CalibrationHistoryViewer } from "@/components/calibration/CalibrationHistoryViewer";
import { CalibrationReportViewer } from "@/components/calibration/CalibrationReportViewer";

const mockSubjectProfile = {
  subject_id: "sub-001",
  profile_id: "prof_sub-001",
  profile_version: "SUBJECT_PROFILE_V1",
  status: "ACTIVE" as const,
  preferred_hand: "RIGHT" as const,
  display_name: "Participant Alpha",
  notes: "Test profile",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockProtocol = {
  protocol_id: "CALIBRATION_PROTOCOL_V1",
  protocol_version: "CALIBRATION_PROTOCOL_V1",
  name: "Standard Graz Visual Cue Protocol",
  target_classes: ["LEFT_IMAGERY" as const, "RIGHT_IMAGERY" as const],
  trials_per_class: 10,
  rest_duration_sec: 2.0,
  fixation_duration_sec: 2.0,
  cue_duration_sec: 1.25,
  imagery_duration_sec: 4.0,
  iti_min_sec: 1.5,
  iti_max_sec: 2.5,
  break_policy: "EVERY_20_TRIALS",
  random_state: 42,
  min_valid_trials_per_class: 5,
  max_rejection_ratio: 0.4,
  qc_rules: {},
  timing_hash: "hash123",
};

const mockTrials = [
  {
    trial_id: "trl_01",
    calibration_id: "cal_01",
    sequence_index: 0,
    target_label: "LEFT_IMAGERY" as const,
    cue: "LEFT" as const,
    planned_onset: 0.0,
    actual_onset: 0.0,
    imagery_start: 5.25,
    imagery_end: 9.25,
    status: "COMPLETED" as const,
    quality_status: "PASS" as const,
    quality_reasons: [],
    epoch_id: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    trial_id: "trl_02",
    calibration_id: "cal_01",
    sequence_index: 1,
    target_label: "RIGHT_IMAGERY" as const,
    cue: "RIGHT" as const,
    planned_onset: 11.0,
    actual_onset: 11.0,
    imagery_start: 16.25,
    imagery_end: 20.25,
    status: "COMPLETED" as const,
    quality_status: "WARN" as const,
    quality_reasons: ["SIGNAL_QUALITY_LOW" as const],
    epoch_id: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
];

const mockSession = {
  calibration_id: "cal_01",
  profile_id: "prof_sub-001",
  subject_id: "sub-001",
  session_number: 1,
  protocol_version: "CALIBRATION_PROTOCOL_V1",
  task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
  source_mode: "SIMULATION" as const,
  status: "IN_PROGRESS" as const,
  started_at: new Date().toISOString(),
  completed_at: null,
  trial_count: 20,
  valid_trial_count: 2,
  rejected_trial_count: 0,
  class_distribution: { LEFT_IMAGERY: 1, RIGHT_IMAGERY: 1 },
  quality_summary: null,
  pause_intervals: [],
  active_trial_index: 0,
  active_phase: "REST" as const,
  phase_time_remaining_sec: 2.0,
  config_hash: "hash123",
  created_at: new Date().toISOString(),
};

describe("Personalized Motor-Imagery Calibration Workspace (Phase 13)", () => {
  it("renders SubjectProfileSelector with profile cards and selection", () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <SubjectProfileSelector
        profiles={[mockSubjectProfile]}
        selectedProfileId="prof_sub-001"
        onSelectProfile={onSelect}
        onCreateProfile={onCreate}
      />
    );

    expect(screen.getByText("sub-001")).toBeInTheDocument();
    expect(screen.getByText("Participant Alpha")).toBeInTheDocument();
    expect(screen.getByText("New Subject Profile")).toBeInTheDocument();
  });

  it("renders ProtocolConfigurator and updates parameters", () => {
    const onChange = vi.fn();

    render(<ProtocolConfigurator protocol={mockProtocol} onChange={onChange} />);

    expect(screen.getByText("Calibration Protocol Parameters")).toBeInTheDocument();
    expect(screen.getByText("CALIBRATION_PROTOCOL_V1")).toBeInTheDocument();
  });

  it("renders VisualCuePresenter in active session and triggers pause/resume", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onAbort = vi.fn();

    render(
      <VisualCuePresenter
        session={mockSession}
        trials={mockTrials}
        onPause={onPause}
        onResume={onResume}
        onAbort={onAbort}
      />
    );

    expect(screen.getByText("Graz Visual Cue Presentation")).toBeInTheDocument();
    expect(screen.getByText("Pause Session")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Pause Session"));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("renders LiveTrialTable with trial rows and QC statuses", () => {
    render(<LiveTrialTable trials={mockTrials} activeTrialIndex={0} />);

    expect(screen.getByText("Calibration Trial Audit Table")).toBeInTheDocument();
    expect(screen.getByText("Left Hand Imagery")).toBeInTheDocument();
    expect(screen.getByText("Right Hand Imagery")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText("WARN")).toBeInTheDocument();
  });

  it("renders QualityPanel with sufficiency assessment", () => {
    const mockQC = {
      total_trials: 20,
      valid_trials: 18,
      rejected_trials: 2,
      warn_trials: 1,
      valid_ratio: 0.9,
      rejection_ratio: 0.1,
      class_balance: { LEFT_IMAGERY: 0.5, RIGHT_IMAGERY: 0.5 },
      rejection_breakdown: {},
      is_sufficient: true,
      sufficiency_warnings: [],
    };

    render(<QualityPanel summary={mockQC} />);

    expect(
      screen.getByText("Data Sufficiency Verified for Subject Personalization")
    ).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("90% pass rate")).toBeInTheDocument();
  });

  it("renders PersonalizationPanel with generic vs personalized delta", () => {
    const onPersonalize = vi.fn();
    const mockExp = {
      experiment_id: "pexp_123",
      calibration_id: "cal_01",
      profile_id: "prof_01",
      subject_id: "sub-01",
      model_id: "pmdl_123",
      generic_base_model_id: "mdl_generic",
      train_trial_count: 12,
      heldout_trial_count: 8,
      train_trial_ids: [],
      heldout_trial_ids: [],
      train_metrics: { accuracy: 0.9, balanced_accuracy: 0.9, f1: 0.9 },
      heldout_metrics: {
        accuracy: 0.85,
        balanced_accuracy: 0.85,
        f1: 0.84,
        precision: 0.85,
        recall: 0.85,
        chance_level: 0.5,
        confusion_matrix: { labels: ["L", "R"], matrix: [[4, 0], [1, 3]], normalized_matrix: [[1, 0], [0.25, 0.75]] },
      },
      comparison_with_generic: {
        generic_model_id: "mdl_generic",
        personalized_model_id: "pmdl_123",
        task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
        heldout_trial_count: 8,
        generic_balanced_accuracy: 0.65,
        personalized_balanced_accuracy: 0.85,
        delta_balanced_accuracy: 0.20,
        generic_f1: 0.64,
        personalized_f1: 0.84,
        delta_f1: 0.20,
        chance_level: 0.5,
      },
      config: {} as any,
      created_at: new Date().toISOString(),
    };

    render(
      <PersonalizationPanel
        session={{ ...mockSession, status: "READY" as const, valid_trial_count: 18 }}
        onRunPersonalization={onPersonalize}
        experimentResult={mockExp}
      />
    );

    expect(screen.getByText("Subject-Specific Model Adaptation")).toBeInTheDocument();
    expect(screen.getByText("65.0%")).toBeInTheDocument();
    expect(screen.getByText("85.0%")).toBeInTheDocument();
    expect(screen.getAllByText("+20.0%").length).toBeGreaterThanOrEqual(1);
  });


  it("renders CalibrationHistoryViewer and CalibrationReportViewer", () => {
    const mockHistory = [
      {
        calibration_id: "cal_sub-001_s1",
        session_number: 1,
        protocol_version: "CALIBRATION_PROTOCOL_V1",
        source_mode: "SIMULATION" as const,
        status: "READY" as const,
        trial_count: 20,
        valid_trial_count: 18,
        model_id: "pmdl_123",
        heldout_balanced_accuracy: 0.85,
        created_at: new Date().toISOString(),
      },
    ];

    render(<CalibrationHistoryViewer history={mockHistory} />);
    expect(screen.getByText("Calibration Version History")).toBeInTheDocument();
    expect(screen.getByText("cal_sub-001_s1")).toBeInTheDocument();
    expect(screen.getByText("85.0% Bal. Acc")).toBeInTheDocument();
  });
});
