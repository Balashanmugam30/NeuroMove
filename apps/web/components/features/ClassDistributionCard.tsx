"use client";

import React from "react";
import { EpochSummary, FeatureSet } from "@neuromove/contracts";

interface ClassDistributionCardProps {
  epochSummary: EpochSummary | null;
  featureSet: FeatureSet | null;
}

export function ClassDistributionCard({
  epochSummary,
  featureSet,
}: ClassDistributionCardProps) {
  if (!epochSummary && !featureSet) {
    return null;
  }

  const distribution = featureSet?.label_distribution || epochSummary?.label_distribution || {};
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  const colors: Record<string, string> = {
    REST: "bg-slate-500 text-white",
    LEFT_IMAGERY: "bg-indigo-600 text-white",
    RIGHT_IMAGERY: "bg-cyan-600 text-white",
    FEET_IMAGERY: "bg-amber-600 text-white",
    BOTH_FISTS_IMAGERY: "bg-purple-600 text-white",
    TONGUE_IMAGERY: "bg-pink-600 text-white",
    UNKNOWN: "bg-rose-500 text-white",
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Trial Class Distribution & Lineage
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Total Trials: <strong className="text-slate-800 dark:text-slate-200">{total}</strong>
        </span>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {Object.entries(distribution).map(([label, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700 dark:text-slate-300">{label}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {count} trials ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors[label] || "bg-indigo-500"} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Lineage & Leakage Prevention Invariant Tags */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Subject Boundaries</div>
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">Preserved</div>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Session Boundaries</div>
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">Preserved</div>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Trace Normalization</div>
          <div className="font-semibold text-indigo-600 dark:text-indigo-400">Enforced</div>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-100 dark:border-slate-800">
          <div className="text-slate-400 text-[10px] uppercase">Intent Decision Claim</div>
          <div className="font-semibold text-slate-500">None (Pure Feature)</div>
        </div>
      </div>
    </div>
  );
}
