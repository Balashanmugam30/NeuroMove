"use client";

import React, { useState } from "react";
import {
  CalibrationMetrics,
  ConfidenceCalibrationProfile,
  CalibrationMethod,
} from "@neuromove/contracts";
import {
  Target,
  Play,
  Cpu,
} from "lucide-react";


interface CalibrationDiagnosticsPanelProps {
  metrics: CalibrationMetrics | null;
  profile: ConfidenceCalibrationProfile | null;
  onFitCalibration?: (method: CalibrationMethod) => Promise<void>;
  isFitting?: boolean;
}

export function CalibrationDiagnosticsPanel({
  metrics,
  profile,
  onFitCalibration,
  isFitting = false,
}: CalibrationDiagnosticsPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<CalibrationMethod>("PLATT");

  const m = metrics || profile?.calibration_metrics;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Calibration Diagnostics & Reliability Curves</h3>
            <p className="text-xs text-slate-500">Zero-leakage calibration metrics, Brier scores, and Expected Calibration Error (ECE)</p>
          </div>
        </div>

        {onFitCalibration && (
          <div className="flex items-center gap-2">
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value as CalibrationMethod)}
              disabled={isFitting}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="PLATT">Platt Scaling (Logistic)</option>
              <option value="ISOTONIC">Isotonic Regression</option>
              <option value="MARGIN_SIGMOID">Margin Sigmoid</option>
              <option value="IDENTITY">Identity (Uncalibrated)</option>
            </select>
            <button
              onClick={() => onFitCalibration(selectedMethod)}
              disabled={isFitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isFitting ? "animate-spin" : ""}`} />
              Fit Calibration
            </button>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      {m ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Brier Score</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{m.brier_score.toFixed(4)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ideal: 0.0 (lower is better)</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Log Loss</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{m.log_loss.toFixed(4)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cross-entropy error</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ECE (Error)</span>
            <div className="text-xl font-bold text-blue-600 mt-1">{(m.expected_calibration_error * 100).toFixed(2)}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Expected calibration gap</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Coverage (&ge;75%)</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">{(m.coverage * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">High confidence ratio</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rejection Rate</span>
            <div className="text-xl font-bold text-amber-600 mt-1">{(m.rejection_rate * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Gated below threshold</div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
          No calibration metrics available.
        </div>
      )}

      {/* Reliability Curve Graphic */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Reliability Diagram (Confidence vs Empirical Accuracy)</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-400 inline-block" /> Perfect Calibration (y = x)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Empirical Reliability
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="h-44 w-full relative flex items-end">
            {/* SVG Plot */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="100" x2="100" y2="100" stroke="#CBD5E1" strokeWidth="1" />
              <line x1="0" y1="0" x2="0" y2="100" stroke="#CBD5E1" strokeWidth="1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2,2" />

              {/* Diagonal line (perfect calibration) */}
              <line x1="0" y1="100" x2="100" y2="0" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="3,3" />

              {/* Reliability curve points & line */}
              {m && m.reliability_curve.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  points={m.reliability_curve
                    .map((b) => `${b.bin_center * 100},${(1.0 - b.empirical_prob) * 100}`)
                    .join(" ")}
                />
              )}

              {/* Data points */}
              {m &&
                m.reliability_curve.map((b, i) => (
                  <circle
                    key={i}
                    cx={b.bin_center * 100}
                    cy={(1.0 - b.empirical_prob) * 100}
                    r="2.5"
                    fill="#1D4ED8"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                ))}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>0% Confidence</span>
            <span>Predicted Confidence Interval &rarr;</span>
            <span>100% Confidence</span>
          </div>
        </div>
      </div>

      {/* Active Calibration Profile Metadata */}
      {profile && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-slate-900 border-b border-slate-200/60 pb-2">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" /> Active Profile: {profile.calibration_id}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Method: {profile.method} ({profile.scope})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 font-medium">Dataset Reference:</span> {profile.fit_dataset_reference}
            </div>
            <div>
              <span className="text-slate-400 font-medium">Fit Timestamp:</span> {new Date(profile.fit_timestamp).toLocaleString()}
            </div>
            <div className="font-mono text-[11px] truncate" title={profile.checksum}>
              <span className="text-slate-400 font-medium font-sans">Checksum:</span> {profile.checksum.slice(0, 16)}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
