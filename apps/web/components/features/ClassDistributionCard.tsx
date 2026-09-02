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
    LEFT_IMAGERY: "bg-blue-600 text-white",
    RIGHT_IMAGERY: "bg-teal-600 text-white",
    FEET_IMAGERY: "bg-amber-600 text-white",
    BOTH_FISTS_IMAGERY: "bg-purple-600 text-white",
    TONGUE_IMAGERY: "bg-pink-600 text-white",
    UNKNOWN: "bg-rose-500 text-white",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">
          Trial Class Distribution & Lineage
        </h3>
        <span className="text-xs text-slate-500">
          Total Trials: <strong className="text-slate-800 font-mono">{total}</strong>
        </span>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {Object.entries(distribution).map(([label, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700 font-mono">{label}</span>
                <span className="text-slate-500 font-mono text-2xs">
                  {count} trials ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors[label] || "bg-blue-500"} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Lineage & Leakage Prevention Invariant Tags */}
      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2 bg-slate-50 rounded border border-slate-200">
          <div className="text-slate-500 text-3xs font-mono font-bold uppercase">Subject Boundaries</div>
          <div className="font-bold text-emerald-700 mt-0.5">Preserved</div>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-200">
          <div className="text-slate-500 text-3xs font-mono font-bold uppercase">Session Boundaries</div>
          <div className="font-bold text-emerald-700 mt-0.5">Preserved</div>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-200">
          <div className="text-slate-500 text-3xs font-mono font-bold uppercase">Trace Normalization</div>
          <div className="font-bold text-blue-700 mt-0.5">Enforced</div>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-200">
          <div className="text-slate-500 text-3xs font-mono font-bold uppercase">Intent Claim</div>
          <div className="font-semibold text-slate-600 mt-0.5">Pure Feature</div>
        </div>
      </div>
    </div>
  );
}
