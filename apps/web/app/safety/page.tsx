"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DecisionExplanation } from "@/components/ui/DecisionExplanation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { fetchSafetyState, triggerEmergencyStop } from "@/lib/api-client";
import { SafetyState } from "@neuromove/contracts";
import { ShieldCheck, ShieldAlert, AlertTriangle, Power } from "lucide-react";

export default function SafetyEnginePage() {
  const { operatingMode } = useMode();
  const { connectionState, latestSnapshot, freshness } = useRealtime();
  const [safetyState, setSafetyState] = useState<SafetyState>({
    runtime_state: "IDLE",
    last_decision: "STOP",
    risk_level: "SAFE",
    emergency_active: false,
    fault_code: null,
    reason_code: "SYS_IDLE",
    reason: "Safe default idle state active.",
    updated_at: new Date().toISOString(),
  });

  // Absorb snapshot
  useEffect(() => {
    if (latestSnapshot?.safety_state) {
      setSafetyState(latestSnapshot.safety_state);
    }
  }, [latestSnapshot]);

  // Subscribe to real-time safety stream
  useRealtimeStream("safety", (msg) => {
    if (msg.event?.payload) {
      const p = msg.event.payload as any;
      setSafetyState((prev) => ({
        ...prev,
        runtime_state: p.target_state || p.runtime_state || prev.runtime_state,
        last_decision: p.decision || prev.last_decision,
        risk_level: p.risk_level || prev.risk_level,
        emergency_active:
          msg.event?.event_type === "EMERGENCY_STOP" || p.emergency_active || false,
        reason: p.reason || p.message || prev.reason,
        updated_at: msg.timestamp || new Date().toISOString(),
      }));
    }
  });

  useEffect(() => {
    fetchSafetyState()
      .then(setSafetyState)
      .catch(() => {});
  }, []);

  const handleEStop = async () => {
    try {
      await triggerEmergencyStop();
      setSafetyState((prev) => ({
        ...prev,
        runtime_state: "EMERGENCY",
        emergency_active: true,
        last_decision: "STOP",
        risk_level: "CRITICAL",
        reason: "Emergency stop triggered by operator command.",
        updated_at: new Date().toISOString(),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const states = ["IDLE", "READY", "CANDIDATE", "CONFIRMED", "EXECUTING"];

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Safety & Arbitration"
        title="Safety Engine & Fail-Safe State Machine"
        description="Deterministic state transition matrix, fail-closed arbitration, and real-time safety stream."
        mode={operatingMode}
        actions={
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEStop}
            icon={<Power className="w-3.5 h-3.5" />}
          >
            Trigger E-STOP
          </Button>
        }
      />

      {/* Safety Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Runtime State"
          value={safetyState.runtime_state}
          subtitle={`Transport: ${connectionState} (${freshness})`}
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
          subtitle={safetyState.reason || "Obstacle & signal quality tier"}
          variant={safetyState.risk_level === "CRITICAL" ? "danger" : safetyState.risk_level === "WARNING" ? "warning" : "safe"}
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        />
        <MetricCard
          title="Emergency Circuit"
          value={safetyState.emergency_active ? "TRIGGERED" : "ARMED"}
          subtitle="Hardware safety loop"
          variant={safetyState.emergency_active ? "danger" : "safe"}
          source="LOCAL SAFETY CORE"
        />
      </div>

      {/* Decision Explanation Component */}
      <DecisionExplanation
        decision={safetyState.last_decision}
        risk={safetyState.risk_level}
        runtimeState={safetyState.runtime_state}
        rationale={safetyState.reason}
        gates={[
          {
            label: "Temporal Intent Confirmation",
            passed: safetyState.runtime_state === "EXECUTING" || safetyState.runtime_state === "CONFIRMED",
            details: "750ms dwell window posterior threshold",
          },
          {
            label: "Electrode Signal Quality SNR",
            passed: safetyState.risk_level !== "CRITICAL",
            details: "C3/Cz/C4 impedance < 20 kΩ",
          },
          {
            label: "Proximity Sensor Clearance",
            passed: safetyState.last_decision !== "BLOCKED",
            details: "Obstacle distance > 50 cm",
          },
          {
            label: "Emergency Stop Circuit",
            passed: !safetyState.emergency_active,
            details: "Hardware fail-closed loop",
          },
        ]}
      />

      {/* Deterministic State Transition Visual Flow */}
      <SectionCard
        title="Deterministic Safety State Machine Matrix"
        description="Sequential transitions: IDLE → READY → CANDIDATE → CONFIRMED → EXECUTING"
      >
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs mt-1">
          {states.map((st, idx) => {
            const isCurrent = safetyState.runtime_state === st;
            return (
              <div
                key={st}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-blue-50 border-blue-300 shadow-2xs font-bold text-blue-900 ring-2 ring-blue-500/20"
                    : "bg-slate-50/70 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span className="font-mono text-slate-400">Step 0{idx + 1}</span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </div>
                <div className="text-xs font-bold font-mono">{st}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 text-2xs">
            <span className="font-semibold text-slate-700">Default Initialization State:</span>
            <span className="font-mono font-bold text-emerald-700">IDLE (Safe Fail-Closed)</span>
          </div>
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-200 text-2xs">
            <span className="font-semibold text-slate-700">Emergency Stop Precedence:</span>
            <span className="font-mono font-bold text-red-700">Interrupts ALL States Instantly (&lt; 5ms)</span>
          </div>
          <div className="flex justify-between items-center text-2xs">
            <span className="font-semibold text-slate-700">Motor Actuation Permission:</span>
            <span className="font-mono font-bold text-slate-900">Requires EXECUTING state + APPROVED decision</span>
          </div>
        </div>
      </SectionCard>

      <Notice variant="info" title="Safety Invariant 01: Fail-Closed Default">
        In the event of lost telemetry packets or sensor anomalies, the safety core immediately drops actuation signals and enters safe deceleration without waiting for host commands.
      </Notice>
    </div>
  );
}
