"use client";

import React, { useState } from "react";
import { CovarianceSet } from "@neuromove/contracts";

interface CovarianceViewerProps {
  covarianceSet: CovarianceSet | null;
}

export function CovarianceViewer({ covarianceSet }: CovarianceViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  if (!covarianceSet || covarianceSet.matrices.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400">
        No covariance matrices generated yet. Run feature extraction to compute spatial covariance.
      </div>
    );
  }

  const matrices = covarianceSet.matrices;
  const currentRecord = matrices[selectedIdx] || matrices[0];
  const channels = covarianceSet.channels;
  const matrix = currentRecord.matrix;

  // Calculate min/max value for color scaling
  let minVal = Infinity;
  let maxVal = -Infinity;
  matrix.forEach((row) => {
    row.forEach((val) => {
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });
  });

  const getColor = (val: number) => {
    const range = maxVal - minVal || 1.0;
    const norm = (val - minVal) / range;
    // Blue to Indigo to Cyan gradient
    const r = Math.round(79 + (6 - 79) * norm);
    const g = Math.round(70 + (182 - 70) * norm);
    const b = Math.round(229 + (212 - 229) * norm);
    return `rgba(${r}, ${g}, ${b}, ${0.2 + 0.75 * norm})`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Spatial Covariance Representation (CSP-Ready)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Trace-normalized sample covariance matrix $C = \frac{"{"}X X^T{"}"}{"{"}\text{"{"}trace{"}"}(X X^T){"}"}$ across sensorimotor channels
          </p>
        </div>

        {/* Matrix Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Trial Epoch:
          </label>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
          >
            {matrices.map((m, idx) => (
              <option key={idx} value={idx}>
                #{idx + 1} ({m.epoch_id} - {m.label})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Covariance Matrix Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-slate-500">Class:</span>{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {currentRecord.label}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Method:</span>{" "}
            <span className="font-mono">{covarianceSet.regularization}</span>
          </div>
          <div>
            <span className="text-slate-500">Trace:</span>{" "}
            <span className="font-mono">{currentRecord.trace.toFixed(4)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            Symmetric: {currentRecord.is_symmetric ? "YES" : "NO"}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
            PSD: {currentRecord.is_positive_semi_definite ? "YES" : "NO"}
          </span>
        </div>
      </div>

      {/* Covariance Heatmap Grid */}
      <div className="flex justify-center p-4">
        <div className="inline-block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden p-2 bg-slate-900">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${channels.length}, minmax(48px, 1fr))`,
            }}
          >
            {matrix.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  style={{ backgroundColor: getColor(val) }}
                  className="h-12 flex flex-col items-center justify-center rounded text-[10px] font-mono text-white transition hover:scale-105"
                  title={`${channels[rIdx]} x ${channels[cIdx]}: ${val.toFixed(6)}`}
                >
                  <span className="font-bold">{val.toFixed(3)}</span>
                  <span className="text-[8px] opacity-75">
                    {channels[rIdx]}-{channels[cIdx]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
