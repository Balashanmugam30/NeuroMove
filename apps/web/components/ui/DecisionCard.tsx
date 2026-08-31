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
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case "BLOCKED":
        return <ShieldAlert className="w-5 h-5 text-amber-400" />;
      case "STOP":
      default:
        return <AlertOctagon className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div
      data-testid="decision-card"
      className={cn(
        "p-5 rounded-lg border border-slate-800 bg-slate-900/60 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {getDecisionIcon()}
          <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
            Safety Arbitration
          </span>
        </div>
        <StatusBadge status={decision} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div>
          <span className="text-[11px] font-mono uppercase text-slate-400">
            Neural Intent
          </span>
          <div className="mt-1 text-base font-mono font-bold text-slate-100">
            {intent}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-slate-400">
            Confidence
          </span>
          <div className="mt-1 text-base font-mono font-semibold text-slate-200">
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-slate-400">
            Runtime State
          </span>
          <div className="mt-1">
            <StatusBadge status={runtimeState} size="sm" />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase text-slate-400">
            Risk Profile
          </span>
          <div className="mt-1">
            <StatusBadge status={risk} size="sm" />
          </div>
        </div>
      </div>

      {rationale && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 flex items-center justify-between">
          <span className="text-slate-400">Arbitration Rationale:</span>
          <span className="text-slate-300">{rationale}</span>
        </div>
      )}
    </div>
  );
}
