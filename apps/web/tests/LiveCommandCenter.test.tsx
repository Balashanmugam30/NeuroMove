import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PipelineFlowStrip } from "../components/live/PipelineFlowStrip";
import { IntentConfidenceCard } from "../components/live/IntentConfidenceCard";
import { SafetyDecisionCard } from "../components/live/SafetyDecisionCard";
import { RuntimeStateCard } from "../components/live/RuntimeStateCard";
import { SignalQualityCard } from "../components/live/SignalQualityCard";
import { EnvironmentCard } from "../components/live/EnvironmentCard";
import { TransportDiagnosticsCard } from "../components/live/TransportDiagnosticsCard";
import { LiveEventTimeline } from "../components/live/LiveEventTimeline";
import { LiveHeader } from "../components/live/LiveHeader";

describe("Live Command Center Components (Phase 06)", () => {
  describe("PipelineFlowStrip", () => {
    it("renders all 6 pipeline stages with correct values", () => {
      render(
        <PipelineFlowStrip
          intent="RIGHT"
          confidence={0.92}
          runtimeState="EXECUTING"
          obstaclePresent={false}
          decision="APPROVED"
          robotMotion="TURNING_RIGHT"
        />
      );

      expect(screen.getByText("1. Intent")).toBeInTheDocument();
      expect(screen.getByText("2. Confidence")).toBeInTheDocument();
      expect(screen.getByText("3. Runtime State")).toBeInTheDocument();
      expect(screen.getByText("4. Environment")).toBeInTheDocument();
      expect(screen.getByText("5. Arbitration")).toBeInTheDocument();
      expect(screen.getByText("6. Mobility")).toBeInTheDocument();
      expect(screen.getByText("RIGHT")).toBeInTheDocument();
      expect(screen.getByText("92%")).toBeInTheDocument();
      expect(screen.getByText("EXECUTING")).toBeInTheDocument();
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
      expect(screen.getByText("TURNING_RIGHT")).toBeInTheDocument();
    });
  });

  describe("IntentConfidenceCard", () => {
    it("renders decoded intent, confidence meter, and cue", () => {
      render(
        <IntentConfidenceCard
          intent="RIGHT"
          confidence={0.92}
          cue="ARROW_RIGHT"
          uiIdentity="PRODUCT"
        />
      );

      expect(screen.getByText("Decoded Neural Intent")).toBeInTheDocument();
      expect(screen.getByText("RIGHT")).toBeInTheDocument();
      expect(screen.getByText("ARROW_RIGHT")).toBeInTheDocument();
      expect(screen.getByText(/92%/i)).toBeInTheDocument();
      expect(screen.getByText("SIMULATED DECODER")).toBeInTheDocument();
    });

    it("renders research mode posterior probability distribution", () => {
      render(
        <IntentConfidenceCard
          intent="LEFT"
          confidence={0.91}
          cue="ARROW_LEFT"
          probabilities={{ RIGHT: 0.04, LEFT: 0.91, NONE: 0.05 }}
          uiIdentity="RESEARCH"
        />
      );

      expect(screen.getByText(/posterior probability vector/i)).toBeInTheDocument();
      expect(screen.getAllByText("91%").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("SafetyDecisionCard", () => {
    it("renders APPROVED decision and risk tier", () => {
      render(
        <SafetyDecisionCard
          decision="APPROVED"
          riskLevel="SAFE"
          rationale="Trajectory clear."
        />
      );

      expect(screen.getByText("Safety Arbitration Verdict")).toBeInTheDocument();
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
      expect(screen.getByText("SAFE")).toBeInTheDocument();
      expect(screen.getByText("Trajectory clear.")).toBeInTheDocument();
      expect(screen.getByText("FAIL-CLOSED")).toBeInTheDocument();
    });

    it("renders BLOCKED decision with obstacle hazard note", () => {
      render(
        <SafetyDecisionCard
          decision="BLOCKED"
          riskLevel="WARNING"
          rationale="Obstacle hazard detected on perimeter."
        />
      );

      expect(screen.getByText("BLOCKED")).toBeInTheDocument();
      expect(screen.getByText("WARNING")).toBeInTheDocument();
      expect(
        screen.getByText("Obstacle hazard detected on perimeter.")
      ).toBeInTheDocument();
    });
  });

  describe("RuntimeStateCard", () => {
    it("renders FSM state, dwell time, and state steps", () => {
      render(
        <RuntimeStateCard
          state="CONFIRMED"
          elapsedSeconds={4.2}
          activeFaults={[]}
        />
      );

      expect(screen.getByText("Temporal Runtime Engine")).toBeInTheDocument();
      expect(screen.getAllByText("CONFIRMED").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("4.2s")).toBeInTheDocument();
      expect(screen.getByText("FSM ENGINE")).toBeInTheDocument();
    });

    it("renders active fault warnings when injected", () => {
      render(
        <RuntimeStateCard
          state="FAULT"
          elapsedSeconds={3.0}
          activeFaults={["EEG_DISCONNECT"]}
        />
      );

      expect(screen.getByText(/active faults: eeg_disconnect/i)).toBeInTheDocument();
    });
  });

  describe("SignalQualityCard", () => {
    it("renders nominal signal quality and channel SNR", () => {
      render(
        <SignalQualityCard
          metrics={{
            overall_score: 0.95,
            dropped_samples: 0,
            sampling_rate_hz: 250,
            channels: { C3: 18.5, Cz: 19.2, C4: 17.9 },
            artifact_flags: [],
            is_acceptable: true,
          }}
          isConnected={true}
        />
      );

      expect(screen.getByText("EEG Signal Quality")).toBeInTheDocument();
      expect(screen.getByText("GOOD (HIGH SNR)")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
      expect(screen.getByText("18.5 dB")).toBeInTheDocument();
      expect(screen.getByText("SYNTHETIC EEG")).toBeInTheDocument();
    });

    it("renders disconnected state when lead-off occurs", () => {
      render(
        <SignalQualityCard
          metrics={null}
          isConnected={false}
        />
      );

      expect(screen.getByText("DISCONNECTED")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  describe("EnvironmentCard", () => {
    it("renders proximity values and clear perimeter status", () => {
      render(
        <EnvironmentCard
          obstacleData={{
            front_cm: 200,
            left_cm: 200,
            right_cm: 200,
            obstacle_present: false,
            direction: "NONE",
            distance_cm: 200,
            confidence: 0.98,
          }}
        />
      );

      expect(screen.getByText("Environment Perception")).toBeInTheDocument();
      expect(screen.getByText("PERIMETER SECURE")).toBeInTheDocument();
      expect(screen.getByText("SIMULATED PROXIMITY")).toBeInTheDocument();
    });

    it("renders obstacle alert when hazard is detected", () => {
      render(
        <EnvironmentCard
          obstacleData={{
            front_cm: 200,
            left_cm: 200,
            right_cm: 35,
            obstacle_present: true,
            direction: "RIGHT",
            distance_cm: 35,
            confidence: 0.98,
          }}
        />
      );

      expect(screen.getByText("OBSTACLE DETECTED (RIGHT)")).toBeInTheDocument();
      expect(screen.getAllByText("35 cm").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("CRITICAL HAZARD")).toBeInTheDocument();
    });
  });

  describe("TransportDiagnosticsCard", () => {
    it("renders connection status, latency, and freshness", () => {
      render(
        <TransportDiagnosticsCard
          connectionState="CONNECTED"
          latencyMs={1.5}
          freshness="FRESH"
          streams={["live", "eeg", "robot", "safety"]}
        />
      );

      expect(screen.getByText("Transport Diagnostics")).toBeInTheDocument();
      expect(screen.getByText("CONNECTED")).toBeInTheDocument();
      expect(screen.getByText("1.5 ms")).toBeInTheDocument();
      expect(screen.getByText("FRESH")).toBeInTheDocument();
      expect(screen.getByText("/live")).toBeInTheDocument();
    });
  });

  describe("LiveEventTimeline", () => {
    const mockEvents = [
      {
        id: "evt_101",
        timestamp: new Date().toISOString(),
        type: "PREDICTION",
        summary: "Predicted RIGHT intent (conf: 0.92)",
        status: "PREDICTION",
        sequence: 12,
        source: "neuromove.decoder",
        payload: { intent: "RIGHT", confidence: 0.92 },
      },
      {
        id: "evt_102",
        timestamp: new Date().toISOString(),
        type: "SAFETY_APPROVED",
        summary: "Execution approved",
        status: "APPROVED",
        sequence: 13,
        source: "safety.arbiter",
        payload: { decision: "APPROVED" },
      },
    ];

    it("renders event list and handles filtering", () => {
      render(<LiveEventTimeline events={mockEvents} />);

      expect(screen.getByText("Canonical Event Stream")).toBeInTheDocument();
      expect(screen.getByText("PREDICTION")).toBeInTheDocument();
      expect(screen.getByText("SAFETY_APPROVED")).toBeInTheDocument();

      // Filter to SAFETY
      fireEvent.click(screen.getByRole("button", { name: "SAFETY" }));
      expect(screen.queryByText("PREDICTION")).not.toBeInTheDocument();
      expect(screen.getByText("SAFETY_APPROVED")).toBeInTheDocument();
    });

    it("expands event details on click", () => {
      render(<LiveEventTimeline events={mockEvents} />);

      const eventButton = screen.getByText("PREDICTION");
      fireEvent.click(eventButton);

      expect(screen.getByText("EVENT ID:")).toBeInTheDocument();
      expect(screen.getByText("evt_101")).toBeInTheDocument();
      expect(screen.getByText("CANONICAL PAYLOAD:")).toBeInTheDocument();
    });
  });

  describe("LiveHeader", () => {
    it("renders session, trial, scenario, and triggers E-STOP", () => {
      const handleEStop = vi.fn();
      const handleSync = vi.fn();

      render(
        <LiveHeader
          mode="SIMULATION"
          connectionState="CONNECTED"
          freshness="FRESH"
          sessionId="ses_test_123"
          trialId="trl_456"
          scenarioName="Right Turn"
          onEStop={handleEStop}
          onSync={handleSync}
        />
      );

      expect(screen.getByText("Live Command Center")).toBeInTheDocument();
      expect(screen.getByText("ses_test_123")).toBeInTheDocument();
      expect(screen.getByText("trl_456")).toBeInTheDocument();
      expect(screen.getByText("Right Turn")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /emergency stop/i }));
      expect(handleEStop).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: /sync telemetry/i }));
      expect(handleSync).toHaveBeenCalledTimes(1);
    });
  });
});
