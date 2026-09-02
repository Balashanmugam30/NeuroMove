"use client";

import React from "react";
import { CandidateComparison } from "@neuromove/contracts";
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CandidateComparisonMatrixProps {
  comparison: CandidateComparison | null;
  isResearchMode: boolean;
}

export const CandidateComparisonMatrix: React.FC<CandidateComparisonMatrixProps> = ({
  comparison,
  isResearchMode,
}) => {
  if (!comparison) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500 shadow-sm">
        No candidate model comparison available. Run an adaptation cycle to generate metrics.
      </div>
    );
  }

  const renderDelta = (delta: number) => {
    const isPositive = delta > 0.0001;
    const isNegative = delta < -0.0001;

    const pct = (delta * 100).toFixed(1);

    if (isPositive) {
      return (
        <span className="inline-flex items-center text-emerald-600 font-semibold gap-0.5">
          <ArrowUpRight className="w-3.5 h-3.5" />+{pct}%
        </span>
      );
    }
    if (isNegative) {
      return (
        <span className="inline-flex items-center text-rose-600 font-semibold gap-0.5">
          <ArrowDownRight className="w-3.5 h-3.5" />{pct}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-slate-500 font-medium gap-0.5">
        <Minus className="w-3.5 h-3.5" />0.0%
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Incumbent vs. Candidate Benchmark Comparison
          </h3>
          <p className="text-xs text-slate-500">
            Evaluated on identical protected validation set ({comparison.validation_sample_count} samples)
          </p>
        </div>
        {comparison.is_regression ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Regression: -{(comparison.regression_amount * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Performance Improved / Guard Satisfied
          </span>
        )}
      </div>

      {/* KPI Comparison Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
              <th className="py-2 px-3 font-semibold">Evaluation Metric</th>
              <th className="py-2 px-3 font-semibold text-center">Incumbent Base</th>
              <th className="py-2 px-3 font-semibold text-center">Adapted Candidate</th>
              <th className="py-2 px-3 font-semibold text-center">Delta (Δ)</th>
              <th className="py-2 px-3 font-semibold text-center">Chance Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            <tr>
              <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                Balanced Accuracy
              </td>
              <td className="py-2.5 px-3 text-center text-slate-700">
                {(comparison.incumbent_balanced_accuracy * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                {(comparison.candidate_balanced_accuracy * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center">
                {renderDelta(comparison.delta_balanced_accuracy)}
              </td>

              <td className="py-2.5 px-3 text-center text-slate-400">
                {(comparison.chance_level * 100).toFixed(0)}%
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                Weighted F1-Score
              </td>
              <td className="py-2.5 px-3 text-center text-slate-700">
                {(comparison.incumbent_f1 * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                {(comparison.candidate_f1 * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center">
                {renderDelta(comparison.delta_f1)}
              </td>
              <td className="py-2.5 px-3 text-center text-slate-400">
                {(comparison.chance_level * 100).toFixed(0)}%
              </td>
            </tr>
            <tr>
              <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                Raw Accuracy
              </td>
              <td className="py-2.5 px-3 text-center text-slate-700">
                {(comparison.incumbent_accuracy * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                {(comparison.candidate_accuracy * 100).toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-center">
                {renderDelta(comparison.delta_accuracy)}
              </td>
              <td className="py-2.5 px-3 text-center text-slate-400">
                {(comparison.chance_level * 100).toFixed(0)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Error Migration Analysis */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-slate-800">
          Validation Error Migration Analysis
        </h4>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            <span className="block text-[10px] uppercase font-bold text-emerald-600">
              Fixed Errors
            </span>
            <span className="text-base font-bold">
              +{comparison.error_analysis.fixed_errors}
            </span>
            <span className="block text-[10px] text-emerald-700 mt-0.5">
              Trials corrected by candidate
            </span>
          </div>
          <div className="p-2 bg-rose-50 text-rose-800 rounded border border-rose-200">
            <span className="block text-[10px] uppercase font-bold text-rose-600">
              New Errors
            </span>
            <span className="text-base font-bold">
              -{comparison.error_analysis.new_errors}
            </span>
            <span className="block text-[10px] text-rose-700 mt-0.5">
              New misclassifications
            </span>
          </div>
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <span className="block text-[10px] uppercase font-bold text-slate-500">
              Persistent Errors
            </span>
            <span className="text-base font-bold">
              {comparison.error_analysis.persistent_errors}
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              Unresolved trials
            </span>
          </div>
        </div>
      </div>

      {/* Confusion Matrices Side-by-Side */}
      {isResearchMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <h5 className="text-[11px] font-semibold text-slate-700 mb-2">
              Incumbent Confusion Matrix
            </h5>
            <div className="grid grid-cols-2 gap-1 text-center font-mono text-xs">
              {comparison.incumbent_confusion_matrix.matrix.map((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`inc_${r}_${c}`}
                    className={`p-2 rounded ${
                      r === c ? "bg-blue-100 text-blue-900 font-bold" : "bg-white text-slate-600"
                    }`}
                  >
                    {cell}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <h5 className="text-[11px] font-semibold text-slate-700 mb-2">
              Candidate Confusion Matrix
            </h5>
            <div className="grid grid-cols-2 gap-1 text-center font-mono text-xs">
              {comparison.candidate_confusion_matrix.matrix.map((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`cand_${r}_${c}`}
                    className={`p-2 rounded ${
                      r === c ? "bg-emerald-100 text-emerald-900 font-bold" : "bg-white text-slate-600"
                    }`}
                  >
                    {cell}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
