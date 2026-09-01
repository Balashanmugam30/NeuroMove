"use client";

import React from "react";
import { ClassificationMetrics } from "@neuromove/contracts";
import { Award, TrendingUp, Target, BarChart2 } from "lucide-react";

interface MetricsCardProps {
  metrics: ClassificationMetrics;
  taskName: string;
  classifierName: string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  metrics,
  taskName,
  classifierName,
}) => {
  const chancePct = (metrics.chance_level * 100).toFixed(1);
  const accPct = (metrics.accuracy.mean * 100).toFixed(1);
  const balAccPct = (metrics.balanced_accuracy.mean * 100).toFixed(1);
  const f1Pct = (metrics.f1.mean * 100).toFixed(1);
  const precPct = (metrics.precision.mean * 100).toFixed(1);
  const recPct = (metrics.recall.mean * 100).toFixed(1);

  const accStdPct = (metrics.accuracy.std * 100).toFixed(1);
  const balAccStdPct = (metrics.balanced_accuracy.std * 100).toFixed(1);
  const f1StdPct = (metrics.f1.std * 100).toFixed(1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Validated Cross-Validation Results
          </span>
          <h3 className="text-base font-bold text-slate-900">
            {classifierName} &bull; {taskName}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
          <Target className="w-3.5 h-3.5 text-slate-500" />
          <span>Chance Level: {chancePct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Balanced Accuracy */}
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-900">
              Balanced Accuracy
            </span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700 tracking-tight font-mono">
              {balAccPct}%
            </div>
            <span className="text-[11px] text-blue-600/80 font-mono">
              &plusmn; {balAccStdPct}% std (min: {(metrics.balanced_accuracy.min * 100).toFixed(0)}%, max: {(metrics.balanced_accuracy.max * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Standard Accuracy */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              Overall Accuracy
            </span>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {accPct}%
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              &plusmn; {accStdPct}% across {metrics.per_fold_results.length} folds
            </span>
          </div>
        </div>

        {/* F1 Score */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">F1 Score</span>
            <BarChart2 className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-teal-700 tracking-tight font-mono">
              {f1Pct}%
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              &plusmn; {f1StdPct}% weighted
            </span>
          </div>
        </div>

        {/* Precision / Recall */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              Precision / Recall
            </span>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-slate-800 font-mono">
              Prec: {precPct}%
            </div>
            <div className="text-sm font-semibold text-slate-800 font-mono">
              Rec: {recPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
