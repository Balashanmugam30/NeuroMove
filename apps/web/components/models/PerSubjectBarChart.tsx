"use client";

import React from "react";
import { PerSubjectMetric } from "@neuromove/contracts";
import { Users } from "lucide-react";

interface PerSubjectBarChartProps {
  data: PerSubjectMetric[];
  chanceLevel?: number;
}

export const PerSubjectBarChart: React.FC<PerSubjectBarChartProps> = ({
  data,
  chanceLevel = 0.5,
}) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Per-Subject Generalization & Variability
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {data.length} Subjects Evaluated
        </span>
      </div>

      <div className="space-y-3 pt-2">
        {data.map((item) => {
          const accPct = item.accuracy * 100;
          const balPct = item.balanced_accuracy * 100;
          const isAboveChance = item.balanced_accuracy >= chanceLevel;

          return (
            <div key={item.subject_id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 font-mono">
                  {item.subject_id}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {item.epoch_count} epochs
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      isAboveChance ? "text-blue-700" : "text-amber-600"
                    }`}
                  >
                    {balPct.toFixed(1)}% bal acc ({accPct.toFixed(1)}% raw)
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                {/* Chance level indicator line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                  style={{ left: `${chanceLevel * 100}%` }}
                  title={`Chance level: ${(chanceLevel * 100).toFixed(0)}%`}
                />

                {/* Score bar */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAboveChance
                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                      : "bg-gradient-to-r from-amber-400 to-amber-500"
                  }`}
                  style={{ width: `${Math.min(Math.max(balPct, 0), 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <span className="inline-block w-2.5 h-0.5 bg-rose-500" />
        <span>Red line denotes theoretical chance level ({(chanceLevel * 100).toFixed(0)}%)</span>
      </div>
    </div>
  );
};
