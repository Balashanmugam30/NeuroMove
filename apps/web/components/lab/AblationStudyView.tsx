"use client";

import React, { useState } from "react";
import { AblationStudyResult } from "@neuromove/contracts";
import { ArrowUpRight, ArrowDownRight, Play, Loader2, GitFork } from "lucide-react";

interface AblationStudyViewProps {
  ablationResult: AblationStudyResult | null;
  onRunAblation: (variable: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AblationStudyView({
  ablationResult,
  onRunAblation,
  isSubmitting,
}: AblationStudyViewProps) {
  const [selectedVariable, setSelectedVariable] = useState<string>("CSP_COMPONENTS");

  return (
    <div className="space-y-6 font-sans">
      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <GitFork className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Controlled Variable Ablation
            </h4>
            <p className="text-xs text-slate-500">
              Isolate one hyperparameter or design factor holding all folds constant.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedVariable}
            disabled={isSubmitting}
            onChange={(e) => setSelectedVariable(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700"
          >
            <option value="CSP_COMPONENTS">CSP Components (2 vs 4 vs 6)</option>
            <option value="MODEL_FAMILY">Model Family (LDA vs SVM vs Logistic)</option>
            <option value="FEATURE_SCALING">Feature Scaling (Off vs On)</option>
          </select>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRunAblation(selectedVariable)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Study...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Ablation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Ablation Results Table */}
      {ablationResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {ablationResult.name}
              </h4>
              <p className="text-[11px] text-slate-500">
                Baseline Balanced Accuracy:{" "}
                <span className="font-bold text-slate-800 font-mono">
                  {(ablationResult.baseline_metrics.balanced_accuracy.mean * 100).toFixed(1)}%
                </span>
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold">
              {ablationResult.ablation_id}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                <tr>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Parameter Value</th>
                  <th className="px-4 py-3 text-right">Balanced Accuracy</th>
                  <th className="px-4 py-3 text-right">F1 Score</th>
                  <th className="px-4 py-3 text-right">&Delta; Balanced Acc</th>
                  <th className="px-4 py-3 text-right">&Delta; F1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ablationResult.variants.map((v) => {
                  const isPositiveDelta = v.delta_balanced_accuracy > 0;
                  const isZeroDelta = v.delta_balanced_accuracy === 0;

                  return (
                    <tr key={v.variant_name} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {v.variant_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {String(v.param_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {(v.metrics.balanced_accuracy.mean * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {(v.metrics.f1.mean * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={`inline-flex items-center space-x-0.5 font-bold ${
                            isZeroDelta
                              ? "text-slate-400"
                              : isPositiveDelta
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {!isZeroDelta &&
                            (isPositiveDelta ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ))}
                          <span>
                            {v.delta_balanced_accuracy > 0 ? "+" : ""}
                            {(v.delta_balanced_accuracy * 100).toFixed(1)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {v.delta_f1 > 0 ? "+" : ""}
                        {(v.delta_f1 * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
