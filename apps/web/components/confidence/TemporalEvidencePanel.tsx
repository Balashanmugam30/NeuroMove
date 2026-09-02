"use client";

import React from "react";
import {
  TemporalConfirmationDecision,
  TemporalConfirmationState,
  TemporalStatus,
} from "@neuromove/contracts";
import {
  Timer,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  PauseCircle,
  Zap,
} from "lucide-react";

interface TemporalEvidencePanelProps {
  temporalDecision: TemporalConfirmationDecision | null;
  state: TemporalConfirmationState | null;
  onReset?: () => void;
  isResetting?: boolean;
}

export function TemporalEvidencePanel({
  temporalDecision,
  state,
  onReset,
  isResetting = false,
}: TemporalEvidencePanelProps) {
  const status: TemporalStatus = state?.status || temporalDecision?.temporal_status || "IDLE";
  const candidate = state?.current_candidate || temporalDecision?.confirmed_prediction || "—";
  const count = state?.consecutive_count ?? temporalDecision?.consecutive_count ?? 0;
  const reqCount = temporalDecision?.required_count ?? 3;
  const durationMs = state?.accumulated_duration_ms ?? temporalDecision?.accumulated_duration_ms ?? 0;
  const reqDurationMs = temporalDecision?.required_duration_ms ?? 500;
  const isConfirmed = temporalDecision?.temporally_confirmed || status === "CONFIRMED";

  const getStatusBadge = (s: TemporalStatus) => {
    switch (s) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
            <CheckCircle2 className="w-4 h-4" /> Temporally Confirmed
          </span>
        );
      case "TRACKING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Zap className="w-3.5 h-3.5 animate-spin" /> Accumulating Evidence
          </span>
        );
      case "COOLDOWN":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <PauseCircle className="w-3.5 h-3.5" /> Cooldown Active
          </span>
        );
      case "REFRACTORY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <Clock className="w-3.5 h-3.5" /> Refractory Period
          </span>
        );
      case "STALE":
      case "REJECTED":
      case "RESET":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5" /> {s}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Timer className="w-3.5 h-3.5" /> Idle
          </span>
        );
    }
  };

  const durationProgress = Math.min(100, Math.round((durationMs / Math.max(1, reqDurationMs)) * 100));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Temporal Confirmation Engine</h3>
            <p className="text-xs text-slate-500">Consecutive window accumulation & hysteresis gating</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(status)}
          {onReset && (
            <button
              onClick={onReset}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Reset temporal confirmation accumulator"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
              Reset State
            </button>
          )}
        </div>
      </div>

      {/* Primary Evidence Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Candidate Class */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidate Class</span>
          <div className="my-2">
            <div className="text-xl font-bold text-slate-900">{candidate}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {status === "CONFIRMED" ? "Confirmed intent ready" : "Accumulating continuity"}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Boundary: isolated per session/model
          </div>
        </div>

        {/* Consecutive Windows */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consecutive Windows</span>
            <span className="text-xs font-bold text-blue-600">{count} / {reqCount}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 my-3">
            {Array.from({ length: reqCount }).map((_, idx) => (
              <div
                key={idx}
                className={`h-3 rounded transition-all duration-300 ${
                  idx < count
                    ? isConfirmed
                      ? "bg-emerald-500"
                      : "bg-blue-500"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <div className="text-[11px] text-slate-500">
            Req: {reqCount} consecutive compliant epochs
          </div>
        </div>

        {/* Accumulated Duration */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence Duration</span>
            <span className="text-xs font-bold text-teal-600">{Math.round(durationMs)} / {reqDurationMs} ms</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-3">
            <div
              className={`h-full transition-all duration-300 ${
                isConfirmed ? "bg-emerald-500" : "bg-teal-500"
              }`}
              style={{ width: `${durationProgress}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500">
            Min Duration: {reqDurationMs}ms sustained
          </div>
        </div>
      </div>

      {/* Hysteresis & Isolation Status */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-semibold text-slate-700">Hysteresis Policy: </span>
            <span className="text-slate-600">Enter &ge; 75% | Exit &lt; 60%</span>
          </div>
          <div className="hidden sm:block text-slate-300">|</div>
          <div>
            <span className="font-semibold text-slate-700">Cooldown: </span>
            <span className="text-slate-600">1000ms</span>
          </div>
        </div>
        {state?.last_reset_reason && (
          <div className="text-slate-500 text-[11px]">
            Last Reset: <span className="font-medium text-slate-700">{state.last_reset_reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
