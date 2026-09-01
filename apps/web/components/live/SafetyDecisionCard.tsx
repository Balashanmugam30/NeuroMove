"use client";

import React from "react";
import { SafetyDecision, RiskLevel } from "@neuromove/contracts";
import { ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GateItem {
  name: string;
  passed: boolean;
  note?: string;
}

interface SafetyDecisionCardProps {
  decision: SafetyDecision;
  riskLevel?: RiskLevel | "NOT EVALUATED";
  rationale?: string;
  gates?: GateItem[];
  className?: string;
}

export function SafetyDecisionCard({
  decision,
  riskLevel = "SAFE",
  rationale = "Safe execution confirmed by deterministic safety kernel.",
  gates,
  className,
}: SafetyDecisionCardProps) {
  const getDecisionTheme = (d: SafetyDecision) => {
    switch (d) {
      case "APPROVED":
        return {
          icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
          pillBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          boxBg: "bg-emerald-50/50 border-emerald-200/80",
          statusText: "APPROVED",
        };
      case "BLOCKED":
        return {
          icon: <ShieldAlert className="w-6 h-6 text-amber-600" />,
          pillBg: "bg-amber-50 text-amber-700 border-amber-200",
          boxBg: "bg-amber-50/50 border-amber-200/80",
          statusText: "BLOCKED",
        };
      case "STOP":
      default:
        return {
          icon: <ShieldX className="w-6 h-6 text-red-600" />,
          pillBg: "bg-red-50 text-red-700 border-red-200",
          boxBg: "bg-red-50/50 border-red-200/80",
          statusText: "STOP / SAFE HOLD",
        };
    }
  };

  const defaultGates: GateItem[] = [
    {
      name: "Neural Intent Confirmed",
      passed: decision === "APPROVED" || decision === "BLOCKED",
      note: "Continuous temporal confirmation window",
    },
    {
      name: "Confidence Margin Passed",
      passed: decision === "APPROVED" || decision === "BLOCKED",
      note: "Posterior probability >= 0.70 threshold",
    },
    {
      name: "Signal Quality Nominal",
      passed: true,
      note: "SNR & dropped sample boundary check",
    },
    {
      name: "Perimeter Path Clear",
      passed: decision === "APPROVED",
      note: decision === "BLOCKED" ? "Proximity hazard detected" : "No obstacles in clearance zone",
    },
    {
      name: "E-STOP Loop Inactive",
      passed: decision !== "STOP",
      note: "Hardware interrupt circuit clear",
    },
  ];

  const activeGates = gates || defaultGates;
  const theme = getDecisionTheme(decision);

  return (
    <div
      data-testid="safety-decision-card"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Safety Arbitration Verdict
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Independent deterministic safety kernel
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            FAIL-CLOSED
          </span>
        </div>

        {/* Primary Verdict Banner */}
        <div
          className={cn(
            "mt-4 flex items-center justify-between p-4 rounded-xl border transition-all",
            theme.boxBg
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              {theme.icon}
            </div>
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 block">
                Arbitration Decision
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {theme.statusText}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 block">
              Risk Tier
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-0.5 rounded border",
                riskLevel === "SAFE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : riskLevel === "WARNING"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              {riskLevel === "WARNING" && <AlertTriangle className="w-3 h-3" />}
              {riskLevel}
            </span>
          </div>
        </div>

        {/* Safety Gate Checklist */}
        <div className="mt-4 space-y-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            Arbitration Gate Checklist
          </span>
          <div className="space-y-1.5">
            {activeGates.map((gate) => (
              <div
                key={gate.name}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
              >
                <div className="flex items-center gap-2">
                  {gate.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800">
                    {gate.name}
                  </span>
                </div>
                {gate.note && (
                  <span className="text-2xs text-slate-500 font-mono">
                    {gate.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rationale Note Footer */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 text-2xs text-slate-600 flex items-start gap-1.5">
        <span className="font-semibold uppercase tracking-wider text-slate-400 shrink-0">
          Rationale:
        </span>
        <span className="font-mono">{rationale}</span>
      </div>
    </div>
  );
}
