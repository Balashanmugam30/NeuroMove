"use client";

import React from "react";
import { EegChannelHealthSnapshot, ChannelQcStatus } from "@neuromove/contracts";
import { CheckCircle2, AlertOctagon, Activity, Zap, RefreshCw } from "lucide-react";

interface ChannelQcMatrixPanelProps {
  channelSnapshots: EegChannelHealthSnapshot[];
  onInjectFault: (faultType: string, params?: Record<string, any>) => void;
  isLoading?: boolean;
}

export const ChannelQcMatrixPanel: React.FC<ChannelQcMatrixPanelProps> = ({
  channelSnapshots,
  onInjectFault,
  isLoading = false,
}) => {
  const getQcBadge = (status: ChannelQcStatus) => {
    switch (status) {
      case "HEALTHY":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case "FLATLINE":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
        };
      case "SATURATION":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
        };
      case "EXCESSIVE_VARIANCE":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200",
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
        };
      case "LOW_VARIANCE":
        return {
          bg: "bg-yellow-50 text-yellow-700 border-yellow-200",
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
        };
      default:
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
        };
    }
  };

  const healthyCount = channelSnapshots.filter((c) => c.is_healthy).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Channel Signal Quality & Impedance Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime rolling statistical quality control • {healthyCount} of {channelSnapshots.length || 8} channels nominal
          </p>
        </div>

        {/* Fault Injection Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onInjectFault("FLATLINE_CHANNEL", { channel: "C3" })}
            disabled={isLoading}
            className="px-2.5 py-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors flex items-center gap-1"
            title="Inject Flatline on C3 channel"
          >
            <Zap className="w-3 h-3 text-amber-600" />
            Fault C3
          </button>
          <button
            onClick={() => onInjectFault("SATURATION_CHANNEL", { channel: "C4" })}
            disabled={isLoading}
            className="px-2.5 py-1 text-[11px] font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1"
            title="Inject Voltage Saturation on C4 channel"
          >
            <Zap className="w-3 h-3 text-rose-600" />
            Fault C4
          </button>
          <button
            onClick={() => onInjectFault("CLEAR")}
            disabled={isLoading}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1"
            title="Clear all active injected faults"
          >
            <RefreshCw className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {/* 8-Channel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {channelSnapshots.map((ch) => {
          const badge = getQcBadge(ch.qc_status);
          return (
            <div
              key={ch.channel_name}
              className={`p-3.5 rounded-lg border transition-all ${
                ch.is_healthy
                  ? "border-slate-200 bg-white hover:border-slate-300"
                  : "border-rose-300 bg-rose-50/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-bold text-slate-900">
                  {ch.channel_name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${badge.bg}`}
                >
                  {badge.icon}
                  {ch.qc_status}
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mean / Std:</span>
                  <span className="font-mono">
                    {ch.mean_amp_uv.toFixed(1)} / {ch.std_amp_uv.toFixed(1)} µV
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Variance:</span>
                  <span className="font-mono">{ch.variance.toFixed(1)} µV²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pk-Pk Range:</span>
                  <span className="font-mono">
                    [{ch.min_amp_uv.toFixed(0)}, {ch.max_amp_uv.toFixed(0)}] µV
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
