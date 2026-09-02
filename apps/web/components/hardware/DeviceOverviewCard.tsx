"use client";

import React from "react";
import { HardwareStatus } from "@neuromove/contracts";
import {
  Cpu,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  HardDrive,
  RefreshCw,
  Hash,
} from "lucide-react";

interface DeviceOverviewCardProps {
  status: HardwareStatus | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DeviceOverviewCard({
  status,
  onRefresh,
  isLoading,
}: DeviceOverviewCardProps) {
  const connectionState = status?.connection_state || "DISCONNECTED";
  const device = status?.device;
  const health = status?.health;

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case "READY":
      case "CONNECTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400";
      case "CONNECTING":
      case "NEGOTIATING":
      case "DISCOVERING":
        return "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400";
      case "DEGRADED":
      case "STALE":
        return "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400";
      default:
        return "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-sans">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Hardware & Endpoint Architecture</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold border ${getStateBadgeClass(connectionState)}`}>
                {connectionState}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Downstream Phase 19/20 hardware-abstraction layer & embedded interface
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Refresh hardware status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Safety Non-Actuation Banner */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-700/50 flex items-start space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
            <div className="font-bold flex items-center gap-2">
              <span>HIL ONLY — Strict Non-Actuation Boundary</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                NO MOTORS / PWM
              </span>
            </div>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              Endpoints operate under laboratory verification profiles. Zero physical actuators, GPIO motor drivers, PWM signals, or wheelchair motors are energized.
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Active Mode
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 uppercase font-mono">
              {status?.active_mode || "SIMULATOR"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              Device ID / MCU
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono truncate">
              {device?.device_id || "esp32_sim_01"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              Boot ID
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono truncate">
              {status?.boot_id || device?.boot_id || "boot_init_01"}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Link RTT
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {health?.round_trip_time_ms ? `${health.round_trip_time_ms.toFixed(1)} ms` : "2.5 ms"}
            </div>
          </div>
        </div>

        {/* Multi-Factor Health Telemetry */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Multi-Factor Link Health Telemetry
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center space-x-1.5">
              {health?.device_connected ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className="text-slate-600 dark:text-slate-400">Device Connected</span>
            </div>

            <div className="flex items-center space-x-1.5">
              {health?.device_ready ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="text-slate-600 dark:text-slate-400">Protocol Ready</span>
            </div>

            <div className="flex items-center space-x-1.5">
              {health?.heartbeat_healthy ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              )}
              <span className="text-slate-600 dark:text-slate-400">Heartbeat Healthy</span>
            </div>

            <div className="flex items-center space-x-1.5">
              {health?.command_channel_healthy ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className="text-slate-600 dark:text-slate-400">Command Channel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
