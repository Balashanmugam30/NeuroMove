"use client";

import React from "react";
import {
  IntentStateSnapshot,
  IntentRecord,
  IntentLifecycleState,
} from "@neuromove/contracts";
import {
  Workflow,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ShieldAlert,
  Zap,
  Check,
  RefreshCw,
} from "lucide-react";

interface CurrentIntentCardProps {
  snapshot: IntentStateSnapshot | null;
  currentIntent: IntentRecord | null;
  onComplete?: () => void;
  onCancel?: () => void;
  onReset?: () => void;
  isActionLoading?: boolean;
}

export function CurrentIntentCard({
  snapshot,
  currentIntent,
  onComplete,
  onCancel,
  onReset,
  isActionLoading = false,
}: CurrentIntentCardProps) {
  const state: IntentLifecycleState = snapshot?.current_state || "NO_INTENT";
  const intentClass = snapshot?.intent_class || currentIntent?.intent_class || "NO_INTENT";
  const intentId = snapshot?.active_intent_id || currentIntent?.intent_id || "—";
  const modelVersion = snapshot?.model_version_id || currentIntent?.model_version_id || "v1";
  const confidence = snapshot?.confidence_score ?? currentIntent?.confidence_score ?? 0;
  const confidencePct = Math.round(confidence * 100);

  const getStateBadge = (s: IntentLifecycleState) => {
    switch (s) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
            <Zap className="w-3.5 h-3.5" /> ACTIVE INTENT
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED
          </span>
        );
      case "CANDIDATE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" /> CANDIDATE
          </span>
        );
      case "REPLACEMENT_PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <PauseCircle className="w-3.5 h-3.5" /> REPLACEMENT PENDING
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Check className="w-3.5 h-3.5" /> COMPLETED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5" /> EXPIRED
          </span>
        );
      case "INTERRUPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-3.5 h-3.5" /> INTERRUPTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertTriangle className="w-3.5 h-3.5" /> NO ACTIVE INTENT
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Authoritative Intent State</h3>
            <p className="text-xs text-slate-500">Subject: {snapshot?.subject_id || "sub-001"} | Session: {snapshot?.session_id || "ses-001"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStateBadge(state)}
          {onReset && (
            <button
              onClick={onReset}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Reset state to NO_INTENT"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Intent Class & ID */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Canonical Intent</span>
          <div className="my-2">
            <div className="text-xl font-bold text-slate-900">{intentClass}</div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate" title={intentId}>
              ID: {intentId}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Model: <span className="font-semibold text-slate-700">{modelVersion}</span>
          </div>
        </div>

        {/* Originating Confidence */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence Confidence</span>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-blue-600 tracking-tight">{confidencePct}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Phase 15 Calibrated</div>
          </div>
          <div className="text-[11px] text-slate-500">
            Transitions: <span className="font-semibold text-slate-700">{snapshot?.transition_count ?? 0}</span>
          </div>
        </div>

        {/* Phase 17 Status Gateway Note */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Downstream Gateway</span>
          <div className="my-2 space-y-1">
            <div className="text-xs font-semibold text-slate-800">
              {state === "ACTIVE" ? "Awaiting Safety Arbitration" : "Lifecycle Standby"}
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {state === "ACTIVE"
                ? "Canonical intent established. Ready for Phase 17 safety admission check."
                : "No active intent queued for downstream evaluation."}
            </p>
          </div>
          <div className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-center">
            No Actuator / Robot Coupling
          </div>
        </div>
      </div>

      {/* Operator Lifecycle Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
        <div className="text-slate-600">
          <span className="font-semibold text-slate-900">Last Reason:</span> {snapshot?.transition_reason || "STATE_RESTORE"}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && state !== "NO_INTENT" && state !== "COMPLETED" && state !== "CANCELLED" && (
            <button
              onClick={onCancel}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Intent
            </button>
          )}

          {onComplete && state === "ACTIVE" && (
            <button
              onClick={onComplete}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Mark Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
