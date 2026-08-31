"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { fetchSafetyState, triggerEmergencyStop } from "@/lib/api-client";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Power,
  RotateCcw,
} from "lucide-react";

export default function SafetyEnginePage() {
  const { operatingMode } = useMode();
  const [safetyState, setSafetyState] = useState<any>({
    runtime_state: "IDLE",
    last_decision: "STOP",
    risk_level: "SAFE",
    emergency_active: false,
    reason: "Safe default idle state active.",
  });

  useEffect(() => {
    fetchSafetyState()
      .then(setSafetyState)
      .catch(() => {});
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
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            Safety Engine & Fail-Safe State Machine
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Deterministic state transition matrix, fail-closed arbitration, and
            watchdog timers.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Current State"
          value={safetyState.runtime_state}
          subtitle="Deterministic container"
          variant={safetyState.emergency_active ? "danger" : "safe"}
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="Arbitration Verdict"
          value={safetyState.last_decision}
          subtitle="Gated execution verdict"
          variant={safetyState.last_decision === "APPROVED" ? "safe" : "danger"}
          icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          title="Risk Classification"
          value={safetyState.risk_level}
          subtitle="Obstacle & signal quality tier"
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
        />
      </div>

      <SectionCard
        title="Deterministic Transition Matrix"
        description="Strict safety state machine: IDLE -> READY -> CANDIDATE -> CONFIRMED -> EXECUTING"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleEStop}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded bg-rose-950/60 border border-rose-700 text-rose-300 hover:bg-rose-900"
            >
              <Power className="w-3 h-3" />
              <span>Trigger E-STOP</span>
            </button>
          </div>
        }
      >
        <div className="p-4 rounded border border-slate-800 bg-slate-950/50 space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">
              Default Initialization State:
            </span>
            <span className="text-emerald-400 font-semibold">
              IDLE (Safe Fail-Closed)
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">Emergency Stop Precedence:</span>
            <span className="text-rose-400 font-semibold">
              Interrupts ALL States Instantly
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Motor Actuation Permission:</span>
            <span className="text-slate-300">
              Requires EXECUTING state + APPROVED decision
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
