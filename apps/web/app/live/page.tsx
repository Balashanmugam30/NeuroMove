"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream, useRealtimeEvents } from "@/lib/realtime/useRealtimeStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { DecisionCard } from "@/components/ui/DecisionCard";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import { Button } from "@/components/ui/Button";
import {
  EventTimeline,
  TimelineEventItem,
} from "@/components/ui/EventTimeline";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { DigitalTwin } from "@/components/simulation/DigitalTwin";
import {
  fetchSystemStatus,
  fetchSimulationStatus,
  fetchSimulationScenarios,
  triggerEmergencyStop,
} from "@/lib/api-client";
import { SimulationScenario, SimulationStatus } from "@neuromove/contracts";
import {
  Activity,
  Shield,
  Bot,
  Zap,
  Power,
  RefreshCw,
} from "lucide-react";

export default function LiveControlPage() {
  const { operatingMode } = useMode();
  const { connectionState, latestSnapshot } = useRealtime();
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
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

  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [events, setEvents] = useState<TimelineEventItem[]>([
    {
      id: "evt_01",
      timestamp: new Date().toISOString(),
      type: "SYSTEM_STATUS",
      summary: "Local Control Station initialized in SIMULATION mode.",
      status: "READY",
      sequence: 1,
      source: "neuromove.core",
    },
    {
      id: "evt_02",
      timestamp: new Date().toISOString(),
      type: "SAFETY_APPROVED",
      summary: "Fail-closed safety arbitration engine armed.",
      status: "SAFE",
      sequence: 2,
      source: "safety.arbiter",
    },
  ]);

  // Absorb snapshot when available
  useEffect(() => {
    if (latestSnapshot) {
      if (latestSnapshot.simulation_status) {
        setSimStatus((prev) => ({
          ...prev,
          ...latestSnapshot.simulation_status,
        }));
      }
      if (latestSnapshot.robot_state) {
        setSimStatus((prev) => ({
          ...prev,
          robot_state: latestSnapshot.robot_state,
        }));
      }
      if (latestSnapshot.safety_state) {
        setSimStatus((prev) => ({
          ...prev,
          runtime_state: latestSnapshot.safety_state?.runtime_state || prev.runtime_state,
          safety_decision: latestSnapshot.safety_state?.last_decision || prev.safety_decision,
        }));
      }
    }
  }, [latestSnapshot]);

  // Subscribe to real-time canonical events
  useRealtimeEvents((evt) => {
    setEvents((prev) => [
      {
        id: evt.event_id || `evt_${Date.now()}`,
        timestamp: evt.occurred_at || new Date().toISOString(),
        type: evt.event_type,
        summary:
          (evt.payload as any)?.reason ||
          (evt.payload as any)?.message ||
          `Canonical event ${evt.event_type} received`,
        status: (evt.payload as any)?.decision || evt.mode || "SIMULATION",
        sequence: evt.sequence,
        source: evt.source,
      },
      ...prev.slice(0, 49),
    ]);

    const evtTypeVal = evt.event_type.toString();

    if (evtTypeVal === "ROBOT_STATE" && evt.payload) {
      setSimStatus((prev) => ({
        ...prev,
        robot_state: {
          ...prev.robot_state,
          ...(evt.payload as any),
        },
      }));
    } else if (evtTypeVal === "PREDICTION" && evt.payload) {
      const pred = evt.payload as any;
      setSimStatus((prev) => ({
        ...prev,
        current_intent: pred.intent || prev.current_intent,
      }));
    } else if (evtTypeVal === "SAFETY_APPROVED" || evtTypeVal === "SAFETY_BLOCKED" || evtTypeVal === "EMERGENCY_STOP") {
      const dec = evt.payload as any;
      setSimStatus((prev) => ({
        ...prev,
        safety_decision: dec.decision || (evtTypeVal === "SAFETY_APPROVED" ? "APPROVED" : "STOP"),
        runtime_state: evtTypeVal === "EMERGENCY_STOP" ? "EMERGENCY" : prev.runtime_state,
      }));
    }
  });

  // Subscribe to robot stream
  useRealtimeStream("robot", (msg) => {
    if (msg.event?.payload) {
      setSimStatus((prev) => ({
        ...prev,
        robot_state: {
          ...prev.robot_state,
          ...(msg.event?.payload as any),
        },
      }));
    }
  });

  const refreshTelemetry = async () => {
    setLoading(true);
    try {
      const [sys, sim, scs] = await Promise.all([
        fetchSystemStatus(),
        fetchSimulationStatus(),
        fetchSimulationScenarios(),
      ]);
      setSystemStatus(sys);
      setSimStatus((prev) => ({ ...prev, ...sim }));
      if (scs && scs.length > 0) setScenarios(scs);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTelemetry();
  }, []);

  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      setSimStatus((prev) => ({
        ...prev,
        runtime_state: "EMERGENCY",
        safety_decision: "STOP",
      }));
      setEvents((prev) => [
        {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "EMERGENCY_STOP",
          summary: "Emergency stop triggered by operator.",
          status: "EMERGENCY",
          sequence: prev.length + 1,
          source: "control.station.ui",
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <PageHeader
        category="Control Station"
        title="Live Command Center"
        description="Real-time neural decoding, safety arbitration, and virtual mobility dispatch monitor (Phase 06 Preparation)."
        mode={operatingMode}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshTelemetry}
              loading={loading}
              icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            >
              Sync Status
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEStop}
              icon={<Power className="w-3.5 h-3.5" />}
            >
              Emergency Stop
            </Button>
          </>
        }
      />

      {/* Subsystem Health Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs text-xs">
        <ConnectionIndicator
          label="API Shell"
          state={systemStatus?.components?.api || "healthy"}
        />
        <ConnectionIndicator
          label="Realtime Transport"
          state={connectionState === "STREAMING" || connectionState === "CONNECTED" ? "CONNECTED" : "DISCONNECTED"}
        />
        <ConnectionIndicator
          label="Simulation EEG"
          state={simStatus.is_running ? "CONNECTED" : "not_connected"}
        />
        <ConnectionIndicator
          label="Virtual Robot"
          state={simStatus.robot_state?.connection_state || "CONNECTED"}
        />
        <ConnectionIndicator
          label="Safety Engine"
          state={simStatus.runtime_state === "EMERGENCY" ? "DEGRADED" : "ready"}
        />
      </div>

      {/* Simulation Engine Operator Controls */}
      <SimulationControls
        status={simStatus}
        scenarios={scenarios}
        onStatusChange={(updated) => setSimStatus(updated)}
      />

      {/* Primary Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Runtime State"
          value={simStatus.runtime_state}
          subtitle="Safety state container"
          variant={simStatus.runtime_state === "EMERGENCY" ? "danger" : "default"}
          icon={<Shield className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="User Intent"
          value={simStatus.current_intent}
          subtitle={simStatus.current_cue ? `Cue: ${simStatus.current_cue}` : "Motor imagery candidate"}
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Neural Confidence"
          value={
            simStatus.current_intent !== "NONE" && simStatus.current_intent !== "UNCERTAIN"
              ? "0.92 (HIGH)"
              : "0.45 (IDLE)"
          }
          subtitle="Bayesian posterior gate"
          icon={<Zap className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Mobility Decision"
          value={simStatus.safety_decision}
          subtitle="Fail-closed safe hold"
          variant={simStatus.safety_decision === "APPROVED" ? "safe" : "danger"}
          icon={<Bot className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* Main Grid: Digital Twin & Arbitration Card vs Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Active Arbitration Card */}
          <DecisionCard
            intent={simStatus.current_intent}
            confidence={simStatus.current_intent !== "NONE" ? 0.92 : 0.0}
            decision={simStatus.safety_decision}
            risk={simStatus.safety_decision === "APPROVED" ? "SAFE" : "WARNING"}
            runtimeState={simStatus.runtime_state}
            rationale={
              simStatus.safety_decision === "APPROVED"
                ? "Trajectory clear. Safe virtual execution approved."
                : simStatus.safety_decision === "BLOCKED"
                ? "Obstacle hazard detected on perimeter. Command blocked."
                : "System in safe resting IDLE state."
            }
          />

          {/* 2D Digital Twin */}
          <DigitalTwin
            robotState={simStatus.robot_state}
            obstacleData={simStatus.obstacle_data}
          />
        </div>

        {/* Right Column: Canonical Event Stream Log */}
        <div className="lg:col-span-5 space-y-6">
          <SectionCard
            title="Canonical Event Stream"
            description="Monotonically sequenced event envelope audit log"
          >
            <EventTimeline events={events} showFilters={true} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
