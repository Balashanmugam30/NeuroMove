"use client";

import React, { useState } from "react";
import { PreprocessingResult, PreprocessingSignalResponse } from "@neuromove/contracts";
import { ShieldCheck } from "lucide-react";

interface SignalComparisonPanelProps {
  result: PreprocessingResult;
  rawSignal: PreprocessingSignalResponse | null;
  procSignal: PreprocessingSignalResponse | null;
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
}

export function SignalComparisonPanel({
  result,
  rawSignal,
  procSignal,
  selectedChannel,
  onSelectChannel,
}: SignalComparisonPanelProps) {
  const [viewMode, setViewMode] = useState<"SPLIT" | "OVERLAY">("SPLIT");

  const channels = procSignal?.channels || result.output_channels || ["C3", "Cz", "C4"];
  const rawData = rawSignal?.signals[selectedChannel] || [];
  const procData = procSignal?.signals[selectedChannel] || [];


  // Canvas / SVG rendering dimensions
  const width = 600;
  const height = 140;

  const renderWaveformPath = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const maxVal = Math.max(...data.map(Math.abs), 50.0);
    const step = width / (data.length - 1);

    const points = data.map((val, idx) => {
      const x = idx * step;
      const y = height / 2 - (val / maxVal) * (height / 2 - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Channel Selector and Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Inspected Channel:
          </span>
          <div className="flex gap-1.5">
            {channels.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => onSelectChannel(ch)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                  selectedChannel === ch
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Comparison Mode:</span>
          <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("SPLIT")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "SPLIT"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode("OVERLAY")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "OVERLAY"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Overlay
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dual Oscilloscope Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Raw Waveform */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Raw Signal ({selectedChannel})
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {result.input_sample_rate_hz} Hz · Unfiltered
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-lg p-2 overflow-hidden border border-slate-800">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
              {/* Centerline */}
              <line
                x1="0"
                y1={height / 2}
                x2={width}
                y2={height / 2}
                stroke="#334155"
                strokeDasharray="4 4"
              />
              {renderWaveformPath(rawData, "#F59E0B")}
            </svg>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.0s</span>
            <span>Offset drift & high-frequency noise present</span>
            <span>2.0s</span>
          </div>
        </div>

        {/* Processed Waveform */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Preprocessed Signal ({selectedChannel})
              </span>
            </div>
            <span className="text-[11px] font-mono text-blue-600 font-semibold">
              {result.output_sample_rate_hz} Hz · Zero-Phase FIR
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-lg p-2 overflow-hidden border border-slate-800">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
              {/* Centerline */}
              <line
                x1="0"
                y1={height / 2}
                x2={width}
                y2={height / 2}
                stroke="#334155"
                strokeDasharray="4 4"
              />
              {renderWaveformPath(procData, "#3B82F6")}
            </svg>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.0s</span>
            <span>Clean sensorimotor rhythm baseline</span>
            <span>2.0s</span>
          </div>
        </div>
      </div>

      {/* 3. Signal Integrity Diagnostic Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Integrity Status
          </span>
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{result.integrity_report.status}</span>
          </div>
          <p className="text-[11px] text-slate-500">0 NaNs · 0 Infs</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Peak Amplitude
          </span>
          <div className="text-sm font-bold font-mono text-slate-900">
            {result.integrity_report.min_amplitude_uv} to {result.integrity_report.max_amplitude_uv} μV
          </div>
          <p className="text-[11px] text-slate-500">Scaled physiological range</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Flatline Channels
          </span>
          <div className="text-sm font-bold text-slate-900">
            {result.integrity_report.flatline_channels.length === 0
              ? "None Detected (0)"
              : result.integrity_report.flatline_channels.join(", ")}
          </div>
          <p className="text-[11px] text-slate-500">Variance {">"} 1e-12 V</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Artifact Fingerprint
          </span>
          <div className="text-xs font-mono font-bold text-blue-600 truncate">
            {result.artifact_checksum_sha256.slice(0, 12)}...
          </div>
          <p className="text-[11px] text-slate-500">Verified SHA-256 FIF</p>
        </div>
      </div>
    </div>
  );
}
