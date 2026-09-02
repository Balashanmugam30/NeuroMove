"use client";

import { MetricResult } from "@neuromove/contracts";
import { BarChart2, Target } from "lucide-react";

interface ScientificMetricsPanelProps {
  metrics: MetricResult | null | undefined;
}

export function ScientificMetricsPanel({ metrics }: ScientificMetricsPanelProps) {
  if (!metrics || metrics.accuracy === null || metrics.accuracy === undefined) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
        <Target className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-semibold text-white">No Evaluation Metrics Available</h4>
        <p className="text-xs">Run a deterministic replay experiment to generate scientific classification and calibration metrics.</p>
      </div>
    );
  }

  const cm = metrics.confusion_matrix;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Scientific Evaluation & Calibration Metrics
            </h3>
            <p className="text-xs text-slate-400">
              Rigorous classification, calibration (ECE), and probabilistic scoring metrics
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-400">
          {metrics.evaluated_trials} / {metrics.total_trials} Trials Evaluated
        </div>
      </div>

      {/* High-level Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            Accuracy
          </span>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {(metrics.accuracy * 100).toFixed(1)}%
          </div>
          <span className="text-3xs text-emerald-400">Balanced: {((metrics.balanced_accuracy ?? metrics.accuracy) * 100).toFixed(1)}%</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            Macro F1-Score
          </span>
          <div className="text-xl font-bold text-indigo-400 font-mono mt-1">
            {metrics.f1_macro?.toFixed(4) ?? "N/A"}
          </div>
          <span className="text-3xs text-slate-400">Prec: {metrics.precision_macro?.toFixed(2)} | Rec: {metrics.recall_macro?.toFixed(2)}</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            Calibration (ECE)
          </span>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
            {metrics.expected_calibration_error?.toFixed(4) ?? "N/A"}
          </div>
          <span className="text-3xs text-slate-400">Brier: {metrics.brier_score?.toFixed(4) ?? "N/A"}</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">
            Rejection Rate
          </span>
          <div className="text-xl font-bold text-slate-200 font-mono mt-1">
            {(metrics.rejection_rate * 100).toFixed(1)}%
          </div>
          <span className="text-3xs text-slate-400">{metrics.rejected_trials} Rejected Trials</span>
        </div>
      </div>

      {/* Confusion Matrix & Per-Class Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Confusion Matrix */}
        {cm && cm.classes && cm.matrix && (
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Confusion Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr>
                    <th className="p-1.5 text-3xs text-slate-400 text-left">True \ Pred</th>
                    {cm.classes.map((c) => (
                      <th key={c} className="p-1.5 text-3xs text-slate-300 font-mono truncate max-w-[60px]" title={c}>
                        {c.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cm.classes.map((trueCls, i) => (
                    <tr key={trueCls} className="border-t border-slate-900">
                      <td className="p-1.5 text-3xs font-semibold text-slate-300 text-left font-mono truncate max-w-[80px]" title={trueCls}>
                        {trueCls}
                      </td>
                      {cm.matrix[i]?.map((val, j) => {
                        const isDiag = i === j;
                        return (
                          <td
                            key={`${i}-${j}`}
                            className={`p-2 font-mono font-bold ${
                              isDiag
                                ? "bg-emerald-500/20 text-emerald-300"
                                : val > 0
                                ? "bg-rose-500/10 text-rose-300"
                                : "text-slate-600"
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
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Per-Class Classification Breakdown
          </h4>
          <div className="space-y-2">
            {Object.keys(metrics.per_class_f1).map((cls) => {
              const f1 = metrics.per_class_f1[cls] ?? 0;
              const prec = metrics.per_class_precision[cls] ?? 0;
              const rec = metrics.per_class_recall[cls] ?? 0;

              return (
                <div key={cls} className="space-y-1 bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div className="flex justify-between text-xs font-semibold text-slate-200">
                    <span className="font-mono">{cls}</span>
                    <span className="font-mono text-indigo-400">F1: {f1.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-3xs text-slate-400 font-mono">
                    <span>Precision: {prec.toFixed(3)}</span>
                    <span>Recall: {rec.toFixed(3)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
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
