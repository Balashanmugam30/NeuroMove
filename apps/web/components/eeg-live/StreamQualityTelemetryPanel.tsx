"use client";

import React from "react";
import { EegStreamHealthSnapshot } from "@neuromove/contracts";
import {
  Gauge,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Layers,
} from "lucide-react";

interface StreamQualityTelemetryPanelProps {
  health: EegStreamHealthSnapshot | null;
}

export const StreamQualityTelemetryPanel: React.FC<StreamQualityTelemetryPanelProps> = ({
  health,
}) => {
  const isNominal = health?.is_nominal ?? true;
  const bufferFillPct = health?.buffer_fill_pct ?? 0;
  const packetLossPct = health?.packet_loss_pct ?? 0;
  const latencyMs = health?.mean_latency_ms ?? 0;
  const clockDriftMs = health?.clock_drift_ms ?? 0;
  const samplesReceived = health?.samples_received ?? 0;
  const samplesDropped = health?.samples_dropped ?? 0;
  const degradedChannels = health?.degraded_channel_count ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-violet-600" />
            Stream Integrity & Clock Synchronization Telemetry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bounded ring buffer occupancy • Monotonicity tracking • Jitter & Drift metrics
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isNominal
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {isNominal ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" />
          )}
          {isNominal ? "STREAM NOMINAL" : "STREAM DEGRADED"}
        </span>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Buffer Fill */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <Database className="w-3.5 h-3.5 text-violet-600" />
            Buffer Fill
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {bufferFillPct.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                bufferFillPct > 80
                  ? "bg-rose-500"
                  : bufferFillPct > 50
                  ? "bg-amber-500"
                  : "bg-violet-600"
              }`}
              style={{ width: `${Math.min(100, bufferFillPct)}%` }}
            />
          </div>
        </div>

        {/* Packet Loss */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            Packet Loss
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {packetLossPct.toFixed(2)}%
          </div>
          <p className="text-[10px] text-slate-400">Zero packet gap target</p>
        </div>

        {/* Ingestion Latency */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Mean Latency
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {latencyMs.toFixed(1)} ms
          </div>
          <p className="text-[10px] text-slate-400">&lt; 10 ms nominal</p>
        </div>

        {/* Clock Drift */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Clock Drift
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {clockDriftMs.toFixed(2)} ms
          </div>
          <p className="text-[10px] text-slate-400">Host/Device sync</p>
        </div>

        {/* Samples Received */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Samples Rx
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {samplesReceived.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400">Dropped: {samplesDropped}</p>
        </div>

        {/* Degraded Channels */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-indigo-600" />
            QC Degraded
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {degradedChannels} / 8
          </div>
          <p className="text-[10px] text-slate-400">
            {degradedChannels === 0 ? "All Channels Clean" : "Gating Applied"}
          </p>
        </div>
      </div>
    </div>
  );
};
