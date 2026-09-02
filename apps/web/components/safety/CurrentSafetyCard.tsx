"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertOctagon,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Unlock,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import { SafetyStateSnapshot } from "@neuromove/contracts";

interface CurrentSafetyCardProps {
  snapshot: SafetyStateSnapshot | null;
  onEmergencyStop: () => Promise<void>;
  onClearEmergencyStop: () => Promise<void>;
  onToggleHold: (hold: boolean) => Promise<void>;
  onReset: () => Promise<void>;
  onLockout: () => Promise<void>;
  onUnlock: () => Promise<void>;
  loading?: boolean;
}

export const CurrentSafetyCard: React.FC<CurrentSafetyCardProps> = ({
  snapshot,
  onEmergencyStop,
  onClearEmergencyStop,
  onToggleHold,
  onReset,
  onLockout,
  onUnlock,
  loading = false,
}) => {
  const [actionLoading, setActionLoading] = useState(false);

  const state = snapshot?.current_state || "SAFE_IDLE";
  const decision = snapshot?.last_decision || "STOP";
  const isEStop = snapshot?.emergency_stop || state === "EMERGENCY_STOP";
  const isHold = snapshot?.operator_hold || state === "HELD";
  const isLockout = snapshot?.lockout || state === "LOCKED_OUT";
  const isResetPending = state === "RESET_PENDING";

  const getStateBadge = () => {
    switch (state) {
      case "AUTHORIZED":
        return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "HELD":
        return "bg-amber-50 text-amber-700 border-amber-300";
      case "DENIED":
        return "bg-rose-50 text-rose-700 border-rose-300";
      case "EMERGENCY_STOP":
        return "bg-red-600 text-white font-bold border-red-700 animate-pulse";
      case "LOCKED_OUT":
        return "bg-purple-50 text-purple-700 border-purple-300";
      case "RESET_PENDING":
        return "bg-orange-50 text-orange-700 border-orange-300";
      case "EVALUATING":
        return "bg-blue-50 text-blue-700 border-blue-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const handleAction = async (fn: () => Promise<void>) => {
    try {
      setActionLoading(true);
      await fn();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center space-x-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm ${
              state === "AUTHORIZED"
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : isEStop
                ? "bg-red-100 border-red-300 text-red-700"
                : isLockout
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : isHold
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            {isEStop ? (
              <AlertOctagon className="w-8 h-8" />
            ) : isLockout ? (
              <Lock className="w-8 h-8" />
            ) : isHold ? (
              <PauseCircle className="w-8 h-8" />
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Authoritative Safety Gate
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStateBadge()}`}
              >
                {state}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              {decision === "AUTHORIZED" ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6" /> Execution Authorized
                </span>
              ) : decision === "HELD" ? (
                <span className="text-amber-600 flex items-center gap-1.5">
                  <PauseCircle className="w-6 h-6" /> Execution Held
                </span>
              ) : decision === "EMERGENCY_STOP" ? (
                <span className="text-red-600 flex items-center gap-1.5">
                  <AlertOctagon className="w-6 h-6" /> Emergency Stop Active
                </span>
              ) : decision === "LOCKED_OUT" ? (
                <span className="text-purple-600 flex items-center gap-1.5">
                  <Lock className="w-6 h-6" /> System Locked Out
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1.5">
                  <XCircle className="w-6 h-6" /> Execution Denied
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {snapshot?.primary_reason || "Safety arbitration gate idle."}
            </p>
          </div>
        </div>

        {/* Primary Safety Operator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Emergency Stop Toggle */}
          {isEStop ? (
            <button
              onClick={() => handleAction(onClearEmergencyStop)}
              disabled={loading || actionLoading}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
              <span>Clear E-Stop</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction(onEmergencyStop)}
              disabled={loading || actionLoading}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>EMERGENCY STOP</span>
            </button>
          )}

          {/* Operator Hold Toggle */}
          <button
            onClick={() => handleAction(() => onToggleHold(!isHold))}
            disabled={loading || actionLoading || isEStop || isLockout}
            className={`px-3.5 py-2.5 rounded-lg font-medium text-sm border transition-colors flex items-center space-x-1.5 disabled:opacity-50 ${
              isHold
                ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isHold ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            <span>{isHold ? "Release Hold" : "Hold"}</span>
          </button>

          {/* Lockout / Unlock Toggle */}
          {isLockout ? (
            <button
              onClick={() => handleAction(onUnlock)}
              disabled={loading || actionLoading || isEStop}
              className="px-3.5 py-2.5 bg-purple-50 border border-purple-300 hover:bg-purple-100 text-purple-800 rounded-lg font-medium text-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>Unlock</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction(onLockout)}
              disabled={loading || actionLoading || isEStop}
              className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>Lockout</span>
            </button>
          )}

          {/* Reset Sequence */}
          <button
            onClick={() => handleAction(onReset)}
            disabled={loading || actionLoading || isEStop}
            className={`px-3.5 py-2.5 rounded-lg font-medium text-sm border transition-colors flex items-center space-x-1.5 disabled:opacity-50 ${
              isResetPending
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 font-semibold animate-pulse"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
            <span>{isResetPending ? "Complete Reset" : "Reset Gate"}</span>
          </button>
        </div>
      </div>

      {/* Snapshot Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 text-xs">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">Policy Version</span>
          <p className="text-slate-900 font-semibold mt-0.5">
            {snapshot?.active_policy_version || "1.0.0"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">Active Intent</span>
          <p className="text-slate-900 font-semibold mt-0.5 truncate">
            {snapshot?.active_intent_id ? (
              <span className="text-teal-700 font-mono">
                {snapshot.intent_class || "INTENT"}: {snapshot.active_intent_id.slice(0, 10)}
              </span>
            ) : (
              <span className="text-slate-400">None</span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">System Health</span>
          <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-900">
            {snapshot?.system_healthy ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Degraded
              </span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">Stream Health</span>
          <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-900">
            {snapshot?.stream_healthy ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Stale / Dropped
              </span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">Transitions</span>
          <p className="text-slate-900 font-semibold mt-0.5 font-mono">
            #{snapshot?.transition_count ?? 0}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-slate-500 font-medium">Last Updated</span>
          <p className="text-slate-900 font-semibold mt-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">
              {snapshot?.updated_at
                ? new Date(snapshot.updated_at).toLocaleTimeString()
                : "Just now"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
