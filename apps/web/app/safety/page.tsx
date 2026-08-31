"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { fetchSafetyState, triggerEmergencyStop } from "@/lib/api-client";
import { ShieldCheck, ShieldAlert, AlertTriangle, Power } from "lucide-react";

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
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Safety Engine & Fail-Safe State Machine
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
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
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Arbitration Verdict"
          value={safetyState.last_decision}
          subtitle="Gated execution verdict"
          variant={safetyState.last_decision === "APPROVED" ? "safe" : "danger"}
          icon={<ShieldAlert className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Risk Classification"
          value={safetyState.risk_level}
          subtitle="Obstacle & signal quality tier"
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        />
      </div>

      <SectionCard
        title="Deterministic Transition Matrix"
        description="Strict safety state machine: IDLE -> READY -> CANDIDATE -> CONFIRMED -> EXECUTING"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleEStop}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 shadow-xs transition-all"
            >
              <Power className="w-3.5 h-3.5 text-red-600" />
              <span>Trigger E-STOP</span>
            </button>
          </div>
        }
      >
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-600 font-medium">
              Default Initialization State:
            </span>
            <span className="text-emerald-700 font-semibold">
              IDLE (Safe Fail-Closed)
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-600 font-medium">
              Emergency Stop Precedence:
            </span>
            <span className="text-red-700 font-semibold">
              Interrupts ALL States Instantly
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">
              Motor Actuation Permission:
            </span>
            <span className="text-slate-900 font-semibold">
              Requires EXECUTING state + APPROVED decision
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
