"use client";

import React from "react";
import { LatencyAnalytics } from "@neuromove/contracts";
import { Clock, Zap } from "lucide-react";

interface LatencyPercentileChartProps {
  latency: LatencyAnalytics | null | undefined;
}

export function LatencyPercentileChart({ latency }: LatencyPercentileChartProps) {
  if (!latency || !latency.per_stage || Object.keys(latency.per_stage).length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-2 font-sans shadow-2xs">
        <Clock className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-900">No Latency Telemetry Available</h4>
        <p className="text-xs text-slate-500">Execute replay experiment to collect per-stage latency percentiles.</p>
      </div>
    );
  }

  const total = latency.total_pipeline;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              End-to-End Pipeline Latency Percentiles
            </h3>
            <p className="text-xs text-slate-500">
              Rigorous timing breakdown across all 15 neurophysiology stages
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-emerald-700 font-bold">
          Mean: {total.mean_ms.toFixed(1)} ms | p95: {total.p95_ms.toFixed(1)} ms
        </div>
      </div>

      {/* Percentiles Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Median (p50)
          </span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
            {total.p50_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            90th Percentile (p90)
          </span>
          <div className="text-lg font-bold text-blue-700 font-mono mt-0.5">
            {total.p90_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            95th Percentile (p95)
          </span>
          <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
            {total.p95_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            99th Percentile (p99)
          </span>
          <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">
            {total.p99_ms.toFixed(1)} ms
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Latency Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-3xs font-mono uppercase">
              <th className="py-2 px-3">Stage</th>
              <th className="py-2 px-2 text-right">Min</th>
              <th className="py-2 px-2 text-right">Mean</th>
              <th className="py-2 px-2 text-right">p50</th>
              <th className="py-2 px-2 text-right">p90</th>
              <th className="py-2 px-2 text-right">p95</th>
              <th className="py-2 px-2 text-right">Max</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {Object.entries(latency.per_stage).map(([stageName, p]) => (
              <tr key={stageName} className="hover:bg-slate-50/70">
                <td className="py-2 px-3 font-semibold text-slate-800">{stageName}</td>
                <td className="py-2 px-2 text-right text-slate-500">{p.min_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-slate-900 font-bold">{p.mean_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-slate-600">{p.p50_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-blue-700 font-semibold">{p.p90_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-amber-700 font-semibold">{p.p95_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-rose-700">{p.max_ms.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
