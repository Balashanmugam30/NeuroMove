"use client";

import React from "react";
import { BenchmarkPreview } from "@neuromove/contracts";
import { Play, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";


interface BenchmarkRunnerProps {
  preview: BenchmarkPreview | null;
  isRunning: boolean;
  onRunBenchmark: () => void;
  disabled?: boolean;
}

export const BenchmarkRunner: React.FC<BenchmarkRunnerProps> = ({
  preview,
  isRunning,
  onRunBenchmark,
  disabled = false,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            3. Benchmark Validation & Execution
          </h3>
          <p className="text-xs text-slate-500">
            Inspect dataset partitions and execute leakage-safe cross-validation.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunBenchmark}
          disabled={disabled || isRunning || (preview !== null && !preview.valid)}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all ${
            isRunning || (preview !== null && !preview.valid) || disabled
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99] border border-blue-600 shadow-blue-500/10"
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Fitting CSP & Evaluating Folds...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Benchmark</span>
            </>
          )}
        </button>
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Eligible Epochs
              </span>
              <span className="font-semibold text-slate-900 font-mono">
                {preview.eligible_epochs} / {preview.total_epochs}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Excluded Labels
              </span>
              <span className="font-semibold text-amber-600 font-mono">
                {preview.excluded_epochs} (rest/unmapped)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Subject Count
              </span>
              <span className="font-semibold text-slate-900 font-mono">
                {preview.subject_count} ({preview.subjects_found.join(", ")})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Expected CV Folds
              </span>
              <span className="font-semibold text-blue-600 font-mono">
                {preview.expected_folds} folds
              </span>
            </div>
          </div>

          {/* Class distribution */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <span className="text-slate-500 font-medium">Class Balance:</span>
            {Object.entries(preview.class_distribution).map(([cls, cnt]) => (
              <span
                key={cls}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[11px]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {cls}: {cnt}
              </span>
            ))}
          </div>

          {/* Warnings & Errors */}
          {preview.warnings.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                {preview.warnings.map((w, idx) => (
                  <p key={idx}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                {preview.errors.map((e, idx) => (
                  <p key={idx}>{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
