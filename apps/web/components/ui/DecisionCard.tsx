import React from "react";
import {
  Intent,
  SafetyDecision,
  RiskLevel,
  RuntimeState,
} from "@neuromove/contracts";
import { StatusBadge } from "./StatusBadge";
import { ShieldCheck, ShieldAlert, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DecisionCardProps {
  intent: Intent;
  confidence: number;
  decision: SafetyDecision;
  risk: RiskLevel;
  runtimeState: RuntimeState;
  rationale?: string;
  className?: string;
}

export function DecisionCard({
  intent,
  confidence,
  decision,
  risk,
  runtimeState,
  rationale = "Standing safe arbitration active.",
  className,
}: DecisionCardProps) {
  const getDecisionIcon = () => {
    switch (decision) {
      case "APPROVED":
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      case "BLOCKED":
        return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      case "STOP":
      default:
        return <AlertOctagon className="w-5 h-5 text-red-600" />;
    }
  };

  return (
    <div
      data-testid="decision-card"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {getDecisionIcon()}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-sans">
              Independent Safety Arbitration
            </span>
          </div>
        </div>
        <StatusBadge status={decision} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[11px] font-medium uppercase text-slate-500 font-sans">
            Neural Intent
          </span>
          <div className="mt-1 text-base font-bold text-slate-900">
            {intent}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[11px] font-medium uppercase text-slate-500 font-sans">
            Confidence
          </span>
          <div className="mt-1 text-base font-bold text-slate-900">
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[11px] font-medium uppercase text-slate-500 font-sans">
            Runtime State
          </span>
          <div className="mt-1">
            <StatusBadge status={runtimeState} size="sm" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[11px] font-medium uppercase text-slate-500 font-sans">
            Risk Profile
          </span>
          <div className="mt-1">
            <StatusBadge status={risk} size="sm" />
          </div>
        </div>
      </div>

      {rationale && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-sans text-slate-600 flex items-center justify-between">
          <span className="text-slate-400 font-medium">
            Arbitration Rationale:
          </span>
          <span className="text-slate-700 font-medium">{rationale}</span>
        </div>
      )}
    </div>
  );
}
