"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisProvenanceFooterProps {
  version?: string;
  sessionId?: string;
  trialId?: string;
  mode?: string;
  engine?: string;
  className?: string;
}

export function AnalysisProvenanceFooter({
  version = "EEG_ANALYSIS_V1",
  sessionId = "ses_sim_001",
  trialId = "trl_001",
  mode = "SIMULATION",
  engine = "MNE-Python 1.12.1",
  className,
}: AnalysisProvenanceFooterProps) {
  return (
    <footer
      data-testid="analysis-provenance-footer"
      className={cn(
        "py-4 px-5 rounded-xl border border-slate-200 bg-white shadow-2xs text-2xs font-mono text-slate-500",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-bold text-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Provenance Spec: {version}
          </span>
          <span className="text-slate-300">|</span>
          <span>Engine: {engine}</span>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span>Mode: {mode}</span>
          <span className="text-slate-300">|</span>
          <span>Session: {sessionId}</span>
          <span className="text-slate-300">|</span>
          <span>Trial: {trialId}</span>
        </div>
      </div>
    </footer>
  );
}
