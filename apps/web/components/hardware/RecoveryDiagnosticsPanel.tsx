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
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs font-sans">
      <div className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">
              Recovery, Diagnostics & Link Health
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fail-closed heartbeat tracking, cold reboot recovery & fault logs
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold border ${
            (heartbeat?.missed_count || 0) === 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-orange-50 text-orange-700 border-orange-200"
          }`}
        >
          {heartbeat?.missed_count || 0} MISSED PINGS
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Telemetry Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-3xs font-bold text-slate-500 uppercase font-mono">
              Missed Heartbeats
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
              {heartbeat?.missed_count || 0} / 3 Max
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-3xs font-bold text-slate-500 uppercase font-mono">
              Last Ping RTT
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
              {heartbeat?.round_trip_time_ms ? `${heartbeat.round_trip_time_ms.toFixed(1)}ms` : "2.5ms"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-3xs font-bold text-slate-500 uppercase font-mono">
              Link Integrity
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
              {health?.application_healthy ? "NOMINAL" : "DEGRADED"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-3xs font-bold text-slate-500 uppercase font-mono">
              Active Session
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1 font-mono truncate">
              {status?.session_id || "None"}
            </div>
          </div>
        </div>

        {/* Recovery Triggers */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 font-mono uppercase text-2xs">
            Link Recovery & Diagnostic Operations
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleAction("ping", onPingHeartbeat)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              {actionLoading === "ping" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-rose-500" />}
              Send Heartbeat Ping
            </button>

            <button
              type="button"
              onClick={() => handleAction("reboot", onRebootDevice)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              {actionLoading === "reboot" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
              Cold Reboot Endpoint
            </button>

            <button
              type="button"
              onClick={() => handleAction("reconnect", onReconnect)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              {actionLoading === "reconnect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-500" />}
              Reconnect & Renegotiate
            </button>

            <button
              type="button"
              onClick={() => handleAction("reset", onResetLab)}
              disabled={isLoading || actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
            >
              {actionLoading === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5 text-slate-600" />}
              Reset Laboratory State
            </button>
          </div>
        </div>

        {/* Diagnostic Event Log */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 font-mono uppercase text-2xs">
            Recent Hardware Diagnostics
          </label>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 font-mono text-xs">
            <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-200 p-2 space-y-1">
              {diagnostics.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs italic">
                  Zero diagnostic warnings or faults recorded.
                </div>
              ) : (
                diagnostics.map((diag) => (
                  <div key={diag.diag_id} className="p-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold border ${
                          diag.severity === "ERROR"
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : diag.severity === "WARNING"
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-slate-700 bg-slate-100 border-slate-200"
                        }`}
                      >
                        {diag.severity}
                      </span>
                      <span className="text-slate-800 truncate text-2xs">{diag.message}</span>
                    </div>
                    <span className="text-3xs text-slate-400 shrink-0 font-mono">
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
