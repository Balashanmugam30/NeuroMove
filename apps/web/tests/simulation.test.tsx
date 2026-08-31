import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { DigitalTwin } from "@/components/simulation/DigitalTwin";
import { EEGOscilloscope } from "@/components/eeg/EEGOscilloscope";
import { SimulationStatus, SimulationScenario } from "@neuromove/contracts";

describe("Phase 03 Simulation UI Components", () => {
  const mockStatus: SimulationStatus = {
    is_running: false,
    is_paused: false,
    mode: "SIMULATION",
    scenario_id: "right-turn",
    scenario_name: "2. Right Turn Motor Imagery",
    seed: 42,
    speed: 1.0,
    elapsed_seconds: 3.5,
    total_duration_seconds: 10.0,
    current_intent: "RIGHT",
    current_cue: "IMAGERY_RIGHT",
    runtime_state: "EXECUTING",
    safety_decision: "APPROVED",
    active_faults: [],
  };

  const mockScenarios: SimulationScenario[] = [
    {
      scenario_id: "right-turn",
      name: "2. Right Turn Motor Imagery",
      description: "Standard Graz trial.",
      seed: 42,
      duration_seconds: 10.0,
      trials_count: 1,
      expected_behavior: "Confirmed RIGHT intent.",
      steps: [],
    },
    {
      scenario_id: "emergency",
      name: "6. Immediate Emergency Stop Trigger",
      description: "Operator emergency stop.",
      seed: 46,
      duration_seconds: 8.0,
      trials_count: 1,
      expected_behavior: "EMERGENCY halt.",
      steps: [],
    },
  ];

  it("renders SimulationControls with scenario choices and start button", () => {
    render(
      <SimulationControls
        status={mockStatus}
        scenarios={mockScenarios}
      />
    );

    expect(screen.getByText("Simulation Engine Control Station")).toBeDefined();
    expect(screen.getByText("SIMULATION")).toBeDefined();
    expect(screen.getByText("Start Scenario")).toBeDefined();
    expect(screen.getByDisplayValue(42)).toBeDefined();
  });

  it("renders DigitalTwin arena with virtual heading and proximity telemetry", () => {
    render(
      <DigitalTwin
        robotState={{
          connection_state: "CONNECTED",
          motion_state: "RIGHT",
          heading_deg: 45.0,
          battery_pct: 92.0,
          left_motor_pwm: 120,
          right_motor_pwm: -120,
          linear_velocity_mps: 0.08,
          angular_velocity_radps: -0.45,
          emergency_stop_triggered: false,
          last_heartbeat: null,
          mode: "SIMULATION",
        }}
        obstacleData={{
          front_cm: 200.0,
          left_cm: 200.0,
          right_cm: 35.0,
          obstacle_present: true,
          direction: "RIGHT",
          distance_cm: 35.0,
          confidence: 0.98,
        }}
      />
    );

    expect(screen.getByText("2D Virtual Digital Twin")).toBeDefined();
    expect(screen.getByText("SIMULATION ONLY")).toBeDefined();
    expect(screen.getByText("RIGHT: 35 cm")).toBeDefined();
    expect(screen.getByText("45.0°")).toBeDefined();
  });

  it("renders EEGOscilloscope with multi-channel and synthetic EEG labeling", () => {
    render(
      <EEGOscilloscope
        channels={["C3", "Cz", "C4"]}
        sampleRateHz={250}
        activeIntent="RIGHT"
        isRunning={true}
      />
    );

    expect(screen.getByText("SYNTHETIC EEG")).toBeDefined();
    expect(screen.getByText("Multi-Channel Electrophysiology Oscilloscope")).toBeDefined();
    expect(screen.getByText("C3 (μ-Power 8-12Hz)")).toBeDefined();
    expect(screen.getByText("C4 (μ-Power 8-12Hz)")).toBeDefined();
  });
});
