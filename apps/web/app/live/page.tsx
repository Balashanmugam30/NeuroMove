"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  useRealtimeStream,
  useRealtimeEvents,
} from "@/lib/realtime/useRealtimeStream";

// Live Command Center Modular Components
import { LiveHeader } from "@/components/live/LiveHeader";
import { PipelineFlowStrip } from "@/components/live/PipelineFlowStrip";
import { IntentConfidenceCard } from "@/components/live/IntentConfidenceCard";
import { SafetyDecisionCard } from "@/components/live/SafetyDecisionCard";
import { RuntimeStateCard } from "@/components/live/RuntimeStateCard";
import { SignalQualityCard } from "@/components/live/SignalQualityCard";
import { EnvironmentCard } from "@/components/live/EnvironmentCard";
import { TransportDiagnosticsCard } from "@/components/live/TransportDiagnosticsCard";
import {
  LiveEventTimeline,
  LiveTimelineEvent,
} from "@/components/live/LiveEventTimeline";

// Simulation & Twin Components
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { DigitalTwin } from "@/components/simulation/DigitalTwin";

// API Clients & Contracts
import {
  fetchSystemStatus,
  fetchSimulationStatus,
  fetchSimulationScenarios,
  triggerEmergencyStop,
} from "@/lib/api-client";
import {
  SimulationScenario,
  SimulationStatus,
  RuntimeState,
  RiskLevel,
  RobotState,
  ObstacleData,
  SignalQualityMetrics,
} from "@neuromove/contracts";

export default function LiveControlPage() {
  const { operatingMode, uiIdentity } = useMode();
  const { connectionState, latencyMs, freshness, latestSnapshot } = useRealtime();

  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);

  // Authoritative simulation state
  const [simStatus, setSimStatus] = useState<SimulationStatus>({
    is_running: false,
    is_paused: false,
    mode: "SIMULATION",
    scenario_id: "right-turn",
    scenario_name: "2. Right Turn Motor Imagery",
    seed: 42,
    speed: 1.0,
    elapsed_seconds: 0,
    total_duration_seconds: 10,
    current_intent: "NONE",
    current_cue: "REST",
    runtime_state: "IDLE",
    safety_decision: "STOP",
    active_faults: [],
  });

  // Telemetry sub-states
  const [robotState, setRobotState] = useState<RobotState>({
    mode: "SIMULATION",
    connection_state: "CONNECTED",
    motion_state: "STOPPED",
    heading_deg: 0,
    battery_pct: 98,
    linear_velocity_mps: 0,
    angular_velocity_radps: 0,
    left_motor_pwm: 0,
    right_motor_pwm: 0,
    emergency_stop_triggered: false,
    last_heartbeat: new Date().toISOString(),
  });

  const [obstacleData, setObstacleData] = useState<ObstacleData>({
    front_cm: 200,
    left_cm: 200,
    right_cm: 200,
    obstacle_present: false,
    direction: "NONE",
    distance_cm: 200,
    confidence: 0.98,
  });

  const [signalQuality, setSignalQuality] = useState<SignalQualityMetrics>({
    overall_score: 0.94,
    channels: { C3: 18.4, Cz: 19.1, C4: 17.6 },
    dropped_samples: 0,
    artifact_flags: [],
    sampling_rate_hz: 250,
    is_acceptable: true,
  });

  const [neuralConfidence, setNeuralConfidence] = useState<number>(0.0);
  const [probabilities, setProbabilities] = useState<Record<string, number>>({
    RIGHT: 0.04,
    LEFT: 0.04,
    NONE: 0.92,
  });

  const [safetyRisk, setSafetyRisk] = useState<RiskLevel>("SAFE");
  const [safetyRationale, setSafetyRationale] = useState<string>(
    "Safe resting state confirmed by deterministic safety kernel."
  );

  // Canonical Event Stream
  const [events, setEvents] = useState<LiveTimelineEvent[]>([
    {
      id: "evt_01",
      timestamp: new Date().toISOString(),
      type: "SYSTEM_INITIALIZED",
      summary: "Local Control Station initialized in SIMULATION mode.",
      status: "READY",
      sequence: 1,
      source: "neuromove.core",
      schemaVersion: "1.0.0",
      correlationId: "cor_init_001",
      payload: { mode: "SIMULATION", status: "OK" },
    },
    {
      id: "evt_02",
      timestamp: new Date().toISOString(),
      type: "SAFETY_ARMED",
      summary: "Fail-closed safety arbitration engine armed.",
      status: "SAFE",
      sequence: 2,
      source: "safety.arbiter",
      schemaVersion: "1.0.0",
      correlationId: "cor_safety_001",
      payload: { arbiter: "FAIL_CLOSED_KERNEL_V1", state: "READY" },
    },
  ]);

  // Absorb initial or updated snapshot from RealtimeProvider
  useEffect(() => {
    if (latestSnapshot) {
      if (latestSnapshot.simulation_status) {
        setSimStatus((prev) => ({
          ...prev,
          ...latestSnapshot.simulation_status,
        }));
      }
      if (latestSnapshot.robot_state) {
        setRobotState((prev) => ({
          ...prev,
          ...latestSnapshot.robot_state,
        }));
      }
      if (latestSnapshot.safety_state) {
        setSimStatus((prev) => ({
          ...prev,
          runtime_state:
            latestSnapshot.safety_state?.runtime_state || prev.runtime_state,
          safety_decision:
            latestSnapshot.safety_state?.last_decision || prev.safety_decision,
        }));
        if (latestSnapshot.safety_state?.risk_level) {
          setSafetyRisk(latestSnapshot.safety_state.risk_level);
        }
      }
    }
  }, [latestSnapshot]);

  // Subscribe to real-time canonical events
  useRealtimeEvents((evt) => {
    const payload = (evt.payload as any) || {};

    // Ingest event to chronological audit timeline (capped at 50)
    setEvents((prev) => [
      {
        id: evt.event_id || `evt_${Date.now()}`,
        timestamp: evt.occurred_at || new Date().toISOString(),
        type: evt.event_type,
        summary:
          payload.reason ||
          payload.message ||
          `Canonical event ${evt.event_type} received`,
        status: payload.decision || evt.mode || "SIMULATION",
        sequence: evt.sequence,
        source: evt.source,
        schemaVersion: evt.schema_version,
        correlationId: evt.correlation_id,
        payload: evt.payload,
      },
      ...prev.slice(0, 49),
    ]);

    const evtType = evt.event_type.toString();

    if (evtType === "PREDICTION") {
      setSimStatus((prev) => ({
        ...prev,
        current_intent: payload.intent || prev.current_intent,
      }));
      if (payload.neural_confidence !== undefined) {
        setNeuralConfidence(payload.neural_confidence);
      }
      if (payload.class_probabilities) {
        setProbabilities(payload.class_probabilities);
      }
    } else if (evtType === "SAFETY_APPROVED" || evtType === "SAFETY_BLOCKED") {
      const isApproved = evtType === "SAFETY_APPROVED";
      setSimStatus((prev) => ({
        ...prev,
        safety_decision: isApproved ? "APPROVED" : "BLOCKED",
      }));
      if (payload.risk_level) {
        setSafetyRisk(payload.risk_level);
      }
      if (payload.reason) {
        setSafetyRationale(payload.reason);
      }
    } else if (evtType === "EMERGENCY_STOP") {
      setSimStatus((prev) => ({
        ...prev,
        runtime_state: "EMERGENCY",
        safety_decision: "STOP",
      }));
      setSafetyRisk("CRITICAL");
      setSafetyRationale("Emergency stop triggered. Actuation blocked.");
    } else if (evtType === "STATE_TRANSITION") {
      if (payload.to_state) {
        setSimStatus((prev) => ({
          ...prev,
          runtime_state: payload.to_state as RuntimeState,
        }));
      }
    } else if (evtType === "ROBOT_STATE") {
      setRobotState((prev) => ({
        ...prev,
        ...payload,
      }));
    } else if (evtType === "SIGNAL_QUALITY") {
      setSignalQuality((prev) => ({
        ...prev,
        overall_score: payload.overall_score ?? payload.quality_score ?? prev.overall_score,
        dropped_samples: payload.dropped_samples ?? prev.dropped_samples,
      }));
    }
  });

  // Subscribe to Robot Stream
  useRealtimeStream("robot", (msg) => {
    if (msg.event?.payload) {
      setRobotState((prev) => ({
        ...prev,
        ...(msg.event?.payload as any),
      }));
    }
  });

  // Subscribe to Safety Stream
  useRealtimeStream("safety", (msg) => {
    if (msg.event?.payload) {
      const payload = msg.event.payload as any;
      if (payload.decision) {
        setSimStatus((prev) => ({
          ...prev,
          safety_decision: payload.decision,
        }));
      }
      if (payload.risk_level) {
        setSafetyRisk(payload.risk_level);
      }
      if (payload.reason) {
        setSafetyRationale(payload.reason);
      }
    }
  });

  // Refresh HTTP Telemetry
  const refreshTelemetry = async () => {
    setLoading(true);
    try {
      const [, sim, scs] = await Promise.all([
        fetchSystemStatus(),
        fetchSimulationStatus(),
        fetchSimulationScenarios(),
      ]);
      setSimStatus((prev) => ({ ...prev, ...sim }));
      if (scs && scs.length > 0) setScenarios(scs);
      if (sim.robot_state) setRobotState(sim.robot_state);
      if (sim.obstacle_data) setObstacleData(sim.obstacle_data);
      if (sim.signal_quality) setSignalQuality(sim.signal_quality);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTelemetry();
  }, []);

  // Emergency Stop Handler
  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      setSimStatus((prev) => ({
        ...prev,
        runtime_state: "EMERGENCY",
        safety_decision: "STOP",
      }));
      setSafetyRisk("CRITICAL");
      setSafetyRationale("Emergency stop triggered by operator.");
      setEvents((prev) => [
        {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "EMERGENCY_STOP",
          summary: "Emergency stop triggered by operator via command center.",
          status: "EMERGENCY",
          sequence: prev.length + 1,
          source: "control.station.ui",
          schemaVersion: "1.0.0",
          correlationId: `cor_estop_${Date.now()}`,
          payload: { trigger: "OPERATOR_ESTOP_BUTTON", action: "HALT_ALL_DRIVE" },
        },
        ...prev,
      ]);
    } catch (e) {
      console.error("Emergency stop failed", e);
    }
  };

  // Synchronize obstacle & simulation state
  useEffect(() => {
    if (simStatus.obstacle_data) {
      setObstacleData(simStatus.obstacle_data);
    }
    if (simStatus.robot_state) {
      setRobotState(simStatus.robot_state);
    }
    if (simStatus.signal_quality) {
      setSignalQuality(simStatus.signal_quality);
    }
    // Update confidence based on current intent
    if (simStatus.current_intent === "RIGHT") {
      setNeuralConfidence(0.92);
      setProbabilities({ RIGHT: 0.92, LEFT: 0.04, NONE: 0.04 });
    } else if (simStatus.current_intent === "LEFT") {
      setNeuralConfidence(0.91);
      setProbabilities({ RIGHT: 0.04, LEFT: 0.91, NONE: 0.05 });
    } else if (simStatus.current_intent === "FORWARD") {
      setNeuralConfidence(0.89);
      setProbabilities({ RIGHT: 0.05, LEFT: 0.05, NONE: 0.02 });
    } else if (simStatus.current_intent === "UNCERTAIN") {
      setNeuralConfidence(0.48);
      setProbabilities({ RIGHT: 0.35, LEFT: 0.33, NONE: 0.32 });
    } else {
      setNeuralConfidence(0.0);
      setProbabilities({ RIGHT: 0.04, LEFT: 0.04, NONE: 0.92 });
    }
  }, [simStatus]);

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      {/* 1. Flagship Live Command Center Header */}
      <LiveHeader
        mode={operatingMode}
        connectionState={connectionState}
        freshness={freshness}
        latencyMs={latencyMs}
        sessionId={simStatus.active_session_id || "ses_sim_001"}
        trialId={simStatus.active_trial_id || "trl_001"}
        scenarioName={simStatus.scenario_name || "2. Right Turn Motor Imagery"}
        onSync={refreshTelemetry}
        onEStop={handleEStop}
        isLoading={loading}
      />

      {/* 2. Pipeline Flow Strip: End-to-End Decision Architecture */}
      <PipelineFlowStrip
        intent={simStatus.current_intent}
        confidence={neuralConfidence}
        runtimeState={simStatus.runtime_state}
        obstaclePresent={obstacleData.obstacle_present}
        decision={simStatus.safety_decision}
        robotMotion={robotState.motion_state}
      />

      {/* 3. Level 1: Core State & Decisions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <IntentConfidenceCard
          intent={simStatus.current_intent}
          confidence={neuralConfidence}
          cue={simStatus.current_cue}
          probabilities={probabilities}
          uiIdentity={uiIdentity}
        />

        <SafetyDecisionCard
          decision={simStatus.safety_decision}
          riskLevel={safetyRisk}
          rationale={safetyRationale}
        />

        <RuntimeStateCard
          state={simStatus.runtime_state}
          elapsedSeconds={simStatus.elapsed_seconds}
          activeFaults={simStatus.active_faults}
        />
      </div>

      {/* 4. Level 2: Electrophysiology, Perception & Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SignalQualityCard
          metrics={signalQuality}
          sampleRateHz={250}
          isConnected={!simStatus.active_faults?.includes("EEG_DISCONNECT")}
        />

        <EnvironmentCard obstacleData={obstacleData} />

        <TransportDiagnosticsCard
          connectionState={connectionState}
          latencyMs={latencyMs}
          freshness={freshness}
          streams={["live", "eeg", "robot", "safety"]}
        />
      </div>

      {/* 5. Level 3 & Level 4: Digital Twin, Controls & Canonical Event Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Twin & Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Simulation Controls Toolbar */}
          <SimulationControls
            status={simStatus}
            scenarios={scenarios}
            onStatusChange={(updated) => setSimStatus(updated)}
          />

          {/* 2D Virtual Digital Twin */}
          <DigitalTwin
            robotState={robotState}
            obstacleData={obstacleData}
          />
        </div>

        {/* Right Column: Canonical Event Stream */}
        <div className="lg:col-span-5 space-y-6">
          <LiveEventTimeline events={events} maxEvents={50} />
        </div>
      </div>
    </div>
  );
}
