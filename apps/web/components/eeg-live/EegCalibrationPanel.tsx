"use client";

import React from "react";
import { EegCalibrationSnapshot } from "@neuromove/contracts";
import {
  Crosshair,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCheck,
  ShieldCheck,
  Hash,
} from "lucide-react";

interface EegCalibrationPanelProps {
  calibration: EegCalibrationSnapshot | null;
  onRunCalibration: () => void;
  isLoading?: boolean;
}

export const EegCalibrationPanel: React.FC<EegCalibrationPanelProps> = ({
  calibration,
  onRunCalibration,
  isLoading = false,
}) => {
  const isReady = calibration?.is_ready ?? false;
  const baselineStd = calibration?.baseline_std_uv ?? {};
  const manifestHash = calibration?.manifest_hash ?? "N/A";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-emerald-600" />
            Live EEG Calibration & Readiness Gate
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            4-step setup verification • Phase 13/14 personalization baseline • Authorization gating
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isReady
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {isReady ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {isReady ? "CALIBRATION READY" : "CALIBRATION REQUIRED"}
          </span>

          <button
            onClick={onRunCalibration}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Calibrating..." : "Run Calibration"}
          </button>
        </div>
      </div>

      {/* 4-Step Setup Progress Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">1. Ingestion</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[11px] text-slate-500">Device linked & sampling</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">2. Signal QC</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[11px] text-slate-500">Impedance & variance nominal</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">3. Baseline</span>
            {isReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
          </div>
          <p className="text-[11px] text-slate-500">Mu/Beta power computed</p>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">4. Gate Authorization</span>
            {isReady ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {isReady ? "Pipeline unlocked" : "Intent blocked (DENIED)"}
          </p>
        </div>
      </div>

      {/* Manifest & Metrics Details */}
      {calibration && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-700">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>Manifest Hash:</span>
              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-900">
                {manifestHash.substring(0, 16)}...
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Calibrated At: {new Date(calibration.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Per-Channel Baseline Metrics Grid */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Channel Baseline Noise Level (Std Dev µV)
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Object.entries(baselineStd).map(([ch, stdVal]) => {
                const std = Number(stdVal);
                return (
                  <div key={ch} className="bg-white p-2 rounded border border-slate-200 text-center">
                    <div className="font-mono text-[10px] font-bold text-slate-500">{ch}</div>
                    <div
                      className={`font-mono text-xs font-semibold ${
                        std >= 5 && std <= 50 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {std.toFixed(1)} µV
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
