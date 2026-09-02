"use client";

import React, { useState } from "react";
import {
  HardwareStatus,
  HardwareDiagnostic,
} from "@neuromove/contracts";
import {
  HeartPulse,
  RotateCcw,
  Activity,
  RefreshCw,
  Loader2,
  Wrench,
} from "lucide-react";

interface RecoveryDiagnosticsPanelProps {
  status: HardwareStatus | null;
  diagnostics: HardwareDiagnostic[];
  onPingHeartbeat: () => Promise<void>;
  onRebootDevice: () => Promise<void>;
  onReconnect: () => Promise<void>;
  onResetLab: () => Promise<void>;
  isLoading?: boolean;
}

export function RecoveryDiagnosticsPanel({
  status,
  diagnostics,
  onPingHeartbeat,
  onRebootDevice,
  onReconnect,
  onResetLab,
  isLoading,
}: RecoveryDiagnosticsPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const heartbeat = status?.heartbeat;
  const health = status?.health;

  const handleAction = async (actionKey: string, callback: () => Promise<void>) => {
    setActionLoading(actionKey);
    try {
      await callback();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-sans">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              Recovery, Diagnostics & Link Health
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fail-closed heartbeat tracking, cold reboot recovery & fault logs
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
            (heartbeat?.missed_count || 0) === 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400"
          }`}
        >
          {heartbeat?.missed_count || 0} MISSED PINGS
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Telemetry Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Missed Heartbeats
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {heartbeat?.missed_count || 0} / 3 Max
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Last Ping RTT
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {heartbeat?.round_trip_time_ms ? `${heartbeat.round_trip_time_ms.toFixed(1)}ms` : "2.5ms"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Link Integrity
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {health?.application_healthy ? "NOMINAL" : "DEGRADED"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Active Session
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono truncate">
              {status?.session_id || "None"}
            </div>
          </div>
        </div>

        {/* Recovery Triggers */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Link Recovery & Diagnostic Operations
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleAction("ping", onPingHeartbeat)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {actionLoading === "ping" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-rose-500" />}
              Send Heartbeat Ping
            </button>

            <button
              type="button"
              onClick={() => handleAction("reboot", onRebootDevice)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {actionLoading === "reboot" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
              Cold Reboot Endpoint
            </button>

            <button
              type="button"
              onClick={() => handleAction("reconnect", onReconnect)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {actionLoading === "reconnect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />}
              Reconnect & Renegotiate
            </button>

            <button
              type="button"
              onClick={() => handleAction("reset", onResetLab)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {actionLoading === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              Reset Laboratory State
            </button>
          </div>
        </div>

        {/* Diagnostic Event Log */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Recent Hardware Diagnostics
          </label>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950 font-mono text-xs">
            <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 p-2 space-y-1">
              {diagnostics.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs italic">
                  Zero diagnostic warnings or faults recorded.
                </div>
              ) : (
                diagnostics.map((diag) => (
                  <div key={diag.diag_id} className="p-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          diag.severity === "ERROR"
                            ? "text-rose-500 border-rose-300"
                            : diag.severity === "WARNING"
                            ? "text-amber-500 border-amber-300"
                            : "text-slate-500 border-slate-300"
                        }`}
                      >
                        {diag.severity}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 truncate">{diag.message}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(diag.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
