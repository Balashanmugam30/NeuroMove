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
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 font-sans shadow-2xs">
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
    // Blue to Indigo gradient on light backdrop
    const r = Math.round(37 + (13 - 37) * norm);
    const g = Math.round(99 + (148 - 99) * norm);
    const b = Math.round(235 + (136 - 235) * norm);
    return `rgba(${r}, ${g}, ${b}, ${0.15 + 0.8 * norm})`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Spatial Covariance Representation (CSP-Ready)
          </h3>
          <p className="text-xs text-slate-500">
            Trace-normalized sample covariance matrix C = XX<sup>T</sup> / trace(XX<sup>T</sup>) across sensorimotor channels
          </p>
        </div>

        {/* Matrix Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 font-mono uppercase text-2xs">
            Trial Epoch:
          </label>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
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
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg text-xs border border-slate-200">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-slate-500">Class:</span>{" "}
            <span className="font-bold text-blue-700 font-mono">
              {currentRecord.label}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Method:</span>{" "}
            <span className="font-mono text-slate-800">{covarianceSet.regularization}</span>
          </div>
          <div>
            <span className="text-slate-500">Trace:</span>{" "}
            <span className="font-mono text-slate-800">{currentRecord.trace.toFixed(4)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Symmetric: {currentRecord.is_symmetric ? "YES" : "NO"}
          </span>
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            PSD: {currentRecord.is_positive_semi_definite ? "YES" : "NO"}
          </span>
        </div>
      </div>

      {/* Covariance Heatmap Grid */}
      <div className="flex justify-center p-4">
        <div className="inline-block border border-slate-200 rounded-xl overflow-hidden p-3 bg-slate-50">
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${channels.length}, minmax(52px, 1fr))`,
            }}
          >
            {matrix.map((row, rIdx) =>
              row.map((val, cIdx) => (
                <div
                  key={`${rIdx}-${cIdx}`}
                  style={{ backgroundColor: getColor(val) }}
                  className="h-12 flex flex-col items-center justify-center rounded-md text-2xs font-mono text-slate-900 border border-slate-200/60 transition hover:scale-105"
                  title={`${channels[rIdx]} x ${channels[cIdx]}: ${val.toFixed(6)}`}
                >
                  <span className="font-bold">{val.toFixed(3)}</span>
                  <span className="text-3xs opacity-75 font-mono">
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
