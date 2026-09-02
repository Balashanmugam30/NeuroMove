"use client";

import React from "react";
import { MetricResult } from "@neuromove/contracts";
import { BarChart2, Target } from "lucide-react";

interface ScientificMetricsPanelProps {
  metrics: MetricResult | null | undefined;
}

export function ScientificMetricsPanel({ metrics }: ScientificMetricsPanelProps) {
  if (!metrics || metrics.accuracy === null || metrics.accuracy === undefined) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-2 font-sans shadow-2xs">
        <Target className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-900">No Evaluation Metrics Available</h4>
        <p className="text-xs text-slate-500">Run a deterministic replay experiment to generate scientific classification and calibration metrics.</p>
      </div>
    );
  }

  const cm = metrics.confusion_matrix;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Scientific Evaluation & Calibration Metrics
            </h3>
            <p className="text-xs text-slate-500">
              Rigorous classification, calibration (ECE), and probabilistic scoring metrics
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-600 font-semibold">
          {metrics.evaluated_trials} / {metrics.total_trials} Trials Evaluated
        </div>
      </div>

      {/* High-level Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Accuracy
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {(metrics.accuracy * 100).toFixed(1)}%
          </div>
          <span className="text-3xs text-emerald-700 font-medium">Balanced: {((metrics.balanced_accuracy ?? metrics.accuracy) * 100).toFixed(1)}%</span>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Macro F1-Score
          </span>
          <div className="text-xl font-bold text-blue-700 font-mono mt-1">
            {metrics.f1_macro?.toFixed(4) ?? "N/A"}
          </div>
          <span className="text-3xs text-slate-500">Prec: {metrics.precision_macro?.toFixed(2)} | Rec: {metrics.recall_macro?.toFixed(2)}</span>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Calibration (ECE)
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {metrics.expected_calibration_error?.toFixed(4) ?? "N/A"}
          </div>
          <span className="text-3xs text-slate-500">Brier: {metrics.brier_score?.toFixed(4) ?? "N/A"}</span>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-3xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Rejection Rate
          </span>
          <div className="text-xl font-bold text-slate-800 font-mono mt-1">
            {(metrics.rejection_rate * 100).toFixed(1)}%
          </div>
          <span className="text-3xs text-slate-500">{metrics.rejected_trials} Rejected Trials</span>
        </div>
      </div>

      {/* Confusion Matrix & Per-Class Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Confusion Matrix */}
        {cm && cm.classes && cm.matrix && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
              Confusion Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr>
                    <th className="p-1.5 text-3xs text-slate-500 text-left font-mono">True \ Pred</th>
                    {cm.classes.map((c) => (
                      <th key={c} className="p-1.5 text-3xs text-slate-700 font-mono truncate max-w-[60px]" title={c}>
                        {c.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cm.classes.map((trueCls, i) => (
                    <tr key={trueCls} className="border-t border-slate-200">
                      <td className="p-1.5 text-3xs font-semibold text-slate-700 text-left font-mono truncate max-w-[80px]" title={trueCls}>
                        {trueCls}
                      </td>
                      {cm.matrix[i]?.map((val, j) => {
                        const isDiag = i === j;
                        return (
                          <td
                            key={`${i}-${j}`}
                            className={`p-2 font-mono font-bold ${
                              isDiag
                                ? "bg-emerald-100 text-emerald-800"
                                : val > 0
                                ? "bg-rose-100 text-rose-800"
                                : "text-slate-400"
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-class Metrics breakdown */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
            Per-Class Classification Breakdown
          </h4>
          <div className="space-y-2">
            {Object.keys(metrics.per_class_f1).map((cls) => {
              const f1 = metrics.per_class_f1[cls] ?? 0;
              const prec = metrics.per_class_precision[cls] ?? 0;
              const rec = metrics.per_class_recall[cls] ?? 0;

              return (
                <div key={cls} className="space-y-1 bg-white p-2 rounded border border-slate-200">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span className="font-mono">{cls}</span>
                    <span className="font-mono text-blue-600">F1: {f1.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-3xs text-slate-500 font-mono">
                    <span>Precision: {prec.toFixed(3)}</span>
                    <span>Recall: {rec.toFixed(3)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, f1 * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
