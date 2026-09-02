"use client";

import React from "react";
import {
  Radio,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Cpu,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { TransportLabStatus } from "@neuromove/contracts";

interface LinkStatusCardProps {
  status: TransportLabStatus | null;
  onReconnect: () => void;
  onPingHeartbeat: () => void;
  isActionLoading?: boolean;
}

export function LinkStatusCard({
  status,
  onReconnect,
  onPingHeartbeat,
  isActionLoading = false,
}: LinkStatusCardProps) {
  const connectionState = status?.connection_state || "DISCONNECTED";

  const getStatusBadge = () => {
    switch (connectionState) {
      case "CONNECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            CONNECTED (HEALTHY)
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            DEGRADED (MISSED BEATS)
          </span>
        );
      case "STALE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            STALE (LINK TIMEOUT)
          </span>
        );
      case "NEGOTIATING":
      case "CONNECTING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            {connectionState}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            DISCONNECTED
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 font-sans">
      {/* Simulation Transparency Disclosure Banner */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-0.5">
          <p className="font-bold tracking-tight">
            Simulation Endpoint — No Physical Hardware Connected
          </p>
          <p className="text-amber-800/90">
            Phase 19 provides pure software framing and an in-memory simulated ESP32 adapter. Commands are transmitted to the simulator only. Zero physical motors, GPIO pins, or vehicles are actuated.
          </p>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Transport Link Status</h3>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-500">
              ESP32 Protocol Framing & Real-Time Bi-Directional Reliability Layer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPingHeartbeat}
            disabled={isActionLoading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            Ping Heartbeat
          </button>
          <button
            type="button"
            onClick={onReconnect}
            disabled={isActionLoading}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
            Renegotiate Link
          </button>
        </div>
      </div>

      {/* Endpoint Metadata & Link Diagnostics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" /> Target Endpoint
          </span>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">
            {status?.device?.device_id || "esp32_sim_01"}
          </p>
          <span className="text-[10px] text-slate-400">
            {status?.device?.device_type || "ESP32_SIMULATOR"}
          </span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-400" /> Protocol Version
          </span>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">
            v{status?.device?.protocol_version || "1.0"}
          </p>
          <span className="text-[10px] text-slate-400">
            Firmware: {status?.device?.firmware_version || "esp32-neuromove-v0.1.0"}
          </span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> Round-Trip Time (RTT)
          </span>
          <p className="text-sm font-bold text-teal-700 font-mono mt-1">
            {status?.heartbeat?.round_trip_time_ms !== null && status?.heartbeat?.round_trip_time_ms !== undefined
              ? `${status.heartbeat.round_trip_time_ms.toFixed(1)} ms`
              : "2.5 ms"}
          </p>
          <span className="text-[10px] text-slate-400">Target latency &lt; 50ms</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-400" /> Missed Heartbeats
          </span>
          <p
            className={`text-sm font-bold font-mono mt-1 ${
              (status?.heartbeat?.missed_count || 0) > 0 ? "text-amber-600" : "text-emerald-700"
            }`}
          >
            {status?.heartbeat?.missed_count ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Fail-closed at 3 misses</span>
        </div>
      </div>
    </div>
  );
}
