"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { DecisionCard } from "@/components/ui/DecisionCard";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import {
  EventTimeline,
  TimelineEventItem,
} from "@/components/ui/EventTimeline";
import {
  fetchSystemStatus,
  fetchSafetyState,
  fetchRobotState,
  triggerEmergencyStop,
} from "@/lib/api-client";
import {
  Activity,
  Shield,
  Bot,
  Zap,
  Power,
  RefreshCw,
  Cpu,
  AlertTriangle,
} from "lucide-react";

export default function LiveControlPage() {
  const { operatingMode } = useMode();
  const [loading, setLoading] = useState(false);
  const [safetyState, setSafetyState] = useState<any>({
    runtime_state: "READY",
    last_decision: "STOP",
    risk_level: "SAFE",
    emergency_active: false,
    reason: "Simulation state machine initialized.",
  });
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [events, setEvents] = useState<TimelineEventItem[]>([
    {
      id: "evt_01",
      timestamp: new Date().toISOString(),
      type: "SYSTEM_STATUS",
      summary: "Local Control Station initialized in SIMULATION mode.",
      status: "READY",
    },
    {
      id: "evt_02",
      timestamp: new Date().toISOString(),
      type: "SAFETY_STATE",
      summary: "Fail-closed safety arbitration engine armed.",
      status: "SAFE",
    },
  ]);

  const refreshTelemetry = async () => {
    setLoading(true);
    try {
      const [sys, safe] = await Promise.all([
        fetchSystemStatus(),
        fetchSafetyState(),
      ]);
      setSystemStatus(sys);
      setSafetyState(safe);
    } catch {
      // Keep deterministic simulation fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      setSafetyState((prev: any) => ({
        ...prev,
        runtime_state: "EMERGENCY",
        emergency_active: true,
        last_decision: "STOP",
        risk_level: "CRITICAL",
      }));
      setEvents((prev) => [
        {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "EMERGENCY_STOP",
          summary: "Emergency stop triggered by operator.",
          status: "EMERGENCY",
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
              Live Command Center
            </h1>
            <ModeBadge mode={operatingMode} />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time neural decoding, safety arbitration, and mobility dispatch
            monitor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshTelemetry}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Sync Status</span>
          </button>

          <button
            onClick={handleEStop}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-rose-950/80 border border-rose-600 text-rose-300 hover:bg-rose-900 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-rose-950/50"
          >
            <Power className="w-3.5 h-3.5 text-rose-400" />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>

      {/* Subsystem Health Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 text-xs font-mono">
        <ConnectionIndicator
          label="API Shell"
          state={systemStatus?.components?.api || "healthy"}
        />
        <ConnectionIndicator
          label="Database"
          state={systemStatus?.components?.database || "not_initialized"}
        />
        <ConnectionIndicator label="BioAmp EEG" state="not_connected" />
        <ConnectionIndicator label="ESP32 Robot" state="not_connected" />
        <ConnectionIndicator
          label="Safety Engine"
          state={safetyState.emergency_active ? "DEGRADED" : "ready"}
        />
      </div>

      {/* Primary Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Runtime State"
          value={safetyState.runtime_state}
          subtitle="Safety state container"
          variant={safetyState.emergency_active ? "danger" : "default"}
          icon={<Shield className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          title="User Intent"
          value="NONE"
          subtitle="Motor imagery candidate"
          icon={<Activity className="w-4 h-4 text-purple-400" />}
        />
        <MetricCard
          title="Neural Confidence"
          value="—"
          subtitle="Bayesian posterior gate"
          icon={<Zap className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          title="Mobility Decision"
          value={safetyState.last_decision}
          subtitle="Fail-closed safe hold"
          variant={safetyState.last_decision === "APPROVED" ? "safe" : "danger"}
          icon={<Bot className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Main Grid: Decision Card & Telemetry Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Arbitration Card */}
          <DecisionCard
            intent="NONE"
            confidence={0.0}
            decision={safetyState.last_decision}
            risk={safetyState.risk_level}
            runtimeState={safetyState.runtime_state}
            rationale={safetyState.reason}
          />

          {/* Signal Quality & Channels Architecture */}
          <SectionCard
            title="EEG Sensor Topology (C3, Cz, C4)"
            description="Electrode contact impedance and sensorimotor power distribution"
          >
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded border border-slate-800 bg-slate-900/30">
                <span className="text-xs font-mono font-bold text-slate-300">
                  Channel C3
                </span>
                <div className="mt-1 text-sm font-mono text-slate-400">
                  Offline
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Left Motor Cortex
                </div>
              </div>
              <div className="p-3 rounded border border-slate-800 bg-slate-900/30">
                <span className="text-xs font-mono font-bold text-slate-300">
                  Channel Cz
                </span>
                <div className="mt-1 text-sm font-mono text-slate-400">
                  Offline
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Vertex Ground
                </div>
              </div>
              <div className="p-3 rounded border border-slate-800 bg-slate-900/30">
                <span className="text-xs font-mono font-bold text-slate-300">
                  Channel C4
                </span>
                <div className="mt-1 text-sm font-mono text-slate-400">
                  Offline
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Right Motor Cortex
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 rounded bg-blue-950/20 border border-blue-900/40 text-xs font-mono text-blue-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Phase 01 Operating Mode: SIMULATION active. Physical acquisition
                offline.
              </span>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Canonical Event Stream Log */}
        <div className="space-y-6">
          <SectionCard
            title="Canonical Event Stream"
            description="Universal event envelope audit trail"
          >
            <EventTimeline events={events} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
