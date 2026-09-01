"use client";

import React from "react";
import { PerSessionMetric } from "@neuromove/contracts";

interface PerSessionBarChartProps {
  metrics: PerSessionMetric[];
  chanceLevel?: number;
}

export function PerSessionBarChart({
  metrics,
  chanceLevel = 0.5,
}: PerSessionBarChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-400 font-sans">
        No per-session performance data available.
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Session Breakdown (Balanced Accuracy)</span>
        <div className="flex items-center space-x-2 text-[11px]">
          <span className="inline-block w-2.5 h-2.5 bg-blue-600 rounded-sm"></span>
          <span>Performance</span>
          <span className="inline-block w-2.5 h-0.5 bg-rose-400"></span>
          <span>Chance Level ({(chanceLevel * 100).toFixed(0)}%)</span>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((m, idx) => {
          const pct = Math.max(0, Math.min(100, m.balanced_accuracy * 100));
          const isAboveChance = m.balanced_accuracy >= chanceLevel;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-slate-700">
                  {m.subject_id} &bull; {m.session_id}
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-md overflow-hidden relative">
                <div
                  className={`h-full transition-all rounded-md ${
                    isAboveChance ? "bg-blue-600" : "bg-amber-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                  style={{ left: `${chanceLevel * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
