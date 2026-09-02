"use client";

import { LatencyAnalytics } from "@neuromove/contracts";
import { Clock, Zap } from "lucide-react";

interface LatencyPercentileChartProps {
  latency: LatencyAnalytics | null | undefined;
}

export function LatencyPercentileChart({ latency }: LatencyPercentileChartProps) {
  if (!latency || !latency.per_stage || Object.keys(latency.per_stage).length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
        <Clock className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-semibold text-white">No Latency Telemetry Available</h4>
        <p className="text-xs">Execute replay experiment to collect per-stage latency percentiles.</p>
      </div>
    );
  }

  const total = latency.total_pipeline;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              End-to-End Pipeline Latency Percentiles
            </h3>
            <p className="text-xs text-slate-400">
              Rigorous timing breakdown across all 15 neurophysiology stages
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-emerald-400 font-bold">
          Mean: {total.mean_ms.toFixed(1)} ms | p95: {total.p95_ms.toFixed(1)} ms
        </div>
      </div>

      {/* Percentiles Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            Median (p50)
          </span>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            {total.p50_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            90th Percentile (p90)
          </span>
          <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
            {total.p90_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            95th Percentile (p95)
          </span>
          <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
            {total.p95_ms.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            99th Percentile (p99)
          </span>
          <div className="text-lg font-bold text-rose-400 font-mono mt-0.5">
            {total.p99_ms.toFixed(1)} ms
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Latency Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-3xs uppercase">
              <th className="py-2 px-3">Stage</th>
              <th className="py-2 px-2 text-right">Min</th>
              <th className="py-2 px-2 text-right">Mean</th>
              <th className="py-2 px-2 text-right">p50</th>
              <th className="py-2 px-2 text-right">p90</th>
              <th className="py-2 px-2 text-right">p95</th>
              <th className="py-2 px-2 text-right">Max</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {Object.entries(latency.per_stage).map(([stageName, p]) => (
              <tr key={stageName} className="hover:bg-slate-800/30">
                <td className="py-2 px-3 font-semibold text-slate-200">{stageName}</td>
                <td className="py-2 px-2 text-right text-slate-400">{p.min_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-white font-bold">{p.mean_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-slate-300">{p.p50_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-indigo-300">{p.p90_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-amber-300">{p.p95_ms.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-rose-400">{p.max_ms.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
