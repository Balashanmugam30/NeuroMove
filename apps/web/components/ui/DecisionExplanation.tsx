"use client";

import React from "react";
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { SafetyDecision, RiskLevel, RuntimeState } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

export interface DecisionGateItem {
  label: string;
  passed: boolean;
  details?: string;
}

export interface DecisionExplanationProps {
  decision: SafetyDecision;
  risk?: RiskLevel;
  runtimeState?: RuntimeState;
  rationale?: string;
  gates?: DecisionGateItem[];
  className?: string;
}

export function DecisionExplanation({
  decision,
  risk = "SAFE",
  runtimeState = "IDLE",
  rationale,
  gates = [
    { label: "Temporal Intent Confirmation", passed: decision === "APPROVED", details: "Posterior confidence threshold met" },
    { label: "Electrode Signal Quality", passed: true, details: "C3/Cz/C4 SNR acceptable" },
    { label: "Proximity Sensor Clearance", passed: decision !== "BLOCKED", details: "Safety envelope clear" },
    { label: "Emergency Stop Circuit", passed: decision !== "STOP" || runtimeState !== "EMERGENCY", details: "Loop armed & nominal" },
  ],
  className,
}: DecisionExplanationProps) {
  const isApproved = decision === "APPROVED";
  const isBlocked = decision === "BLOCKED";

  const bannerStyles = isApproved
    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
    : isBlocked
    ? "bg-amber-50/80 border-amber-200 text-amber-950"
    : "bg-red-50/80 border-red-200 text-red-950";

  const verdictIcon = isApproved ? (
    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
  ) : isBlocked ? (
    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
  ) : (
    <ShieldX className="w-5 h-5 text-red-600 shrink-0" />
  );

  return (
    <div className={cn("p-4 rounded-xl border space-y-3 font-sans shadow-xs", bannerStyles, className)}>
      {/* Header Verdict */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          {verdictIcon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Safety Arbitration Verdict:
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase",
                  isApproved
                    ? "bg-emerald-600 text-white"
                    : isBlocked
                    ? "bg-amber-600 text-white"
                    : "bg-red-600 text-white"
                )}
              >
                {decision}
              </span>
            </div>
            <p className="text-2xs opacity-80 mt-0.5">
              {rationale || (isApproved ? "Safe execution approved by fail-closed core." : "Command held by safety arbitration.")}
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-white/70 border border-black/10">
            Risk: {risk} | State: {runtimeState}
          </span>
        </div>
      </div>

      {/* Evaluated Safety Gates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {gates.map((gate, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 p-2 rounded-lg bg-white/70 border border-black/5"
          >
            {gate.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 text-2xs block">
                {gate.label}
              </span>
              {gate.details && (
                <span className="text-2xs text-slate-500 block leading-tight">
                  {gate.details}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
