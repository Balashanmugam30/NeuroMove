"use client";

import React, { useState, useEffect, useRef } from "react";
import { EpochRecord, EpochSignalResponse } from "@neuromove/contracts";

interface EpochVisualizerProps {
  records: EpochRecord[];
  onFetchSignal: (epochId: string) => Promise<EpochSignalResponse | null>;
}

export function EpochVisualizer({ records, onFetchSignal }: EpochVisualizerProps) {
  const [selectedEpochId, setSelectedEpochId] = useState<string>(records[0]?.epoch_id || "");
  const [signalData, setSignalData] = useState<EpochSignalResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (records.length > 0 && !selectedEpochId) {
      setSelectedEpochId(records[0].epoch_id);
    }
  }, [records, selectedEpochId]);

  useEffect(() => {
    if (!selectedEpochId) return;
    let isMounted = true;
    setLoading(true);
    onFetchSignal(selectedEpochId)
      .then((data) => {
        if (isMounted) setSignalData(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedEpochId, onFetchSignal]);

  // Render canvas multi-channel waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !signalData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const channels = signalData.channels;
    const timePoints = signalData.time_points;
    const nTimes = timePoints.length;
    if (nTimes === 0 || channels.length === 0) return;

    const tMin = timePoints[0];
    const tMax = timePoints[timePoints.length - 1];
    const tRange = tMax - tMin || 1.0;

    const getX = (t: number) => ((t - tMin) / tRange) * width;

    // Draw baseline window shading
    if (signalData.baseline_window) {
      const [bStart, bEnd] = signalData.baseline_window;
      const xStart = Math.max(0, getX(bStart));
      const xEnd = Math.min(width, getX(bEnd));
      ctx.fillStyle = "rgba(148, 163, 184, 0.15)";
      ctx.fillRect(xStart, 0, xEnd - xStart, height);
    }

    // Draw analysis window shading
    if (signalData.analysis_window) {
      const [aStart, aEnd] = signalData.analysis_window;
      const xStart = Math.max(0, getX(aStart));
      const xEnd = Math.min(width, getX(aEnd));
      ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
      ctx.fillRect(xStart, 0, xEnd - xStart, height);
    }

    // Draw cue onset vertical line (t = 0)
    const xZero = getX(0.0);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xZero, 0);
    ctx.lineTo(xZero, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel colors
    const colors = [
      "#4f46e5",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
      "#14b8a6",
      "#6366f1",
    ];

    const slotHeight = height / channels.length;
    const maxAmp = 50.0; // +/- 50 uV scale

    channels.forEach((ch, chIdx) => {
      const centerY = slotHeight * (chIdx + 0.5);
      const chSignals = signalData.signals[ch] || [];

      // Channel baseline guide
      ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Channel name
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText(ch, 8, centerY - 6);

      // Waveform path
      ctx.strokeStyle = colors[chIdx % colors.length];
      ctx.lineWidth = 1.25;
      ctx.beginPath();

      for (let i = 0; i < nTimes; i++) {
        const x = getX(timePoints[i]);
        const val = chSignals[i] || 0.0;
        const normalizedY = centerY - (val / maxAmp) * (slotHeight * 0.4);
        if (i === 0) ctx.moveTo(x, normalizedY);
        else ctx.lineTo(x, normalizedY);
      }
      ctx.stroke();
    });
  }, [signalData]);

  const currentRecord = records.find((r) => r.epoch_id === selectedEpochId);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Epoch Waveform Inspection
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Synchronized motor-imagery trial time-series with baseline and cue onset markers
          </p>
        </div>

        {/* Epoch Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Epoch Trial:
          </label>
          <select
            value={selectedEpochId}
            onChange={(e) => setSelectedEpochId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
          >
            {records.map((rec) => (
              <option key={rec.epoch_id} value={rec.epoch_id}>
                {rec.epoch_id} ({rec.label} - {rec.qc_status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* QC Status & Metadata Header */}
      {currentRecord && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-slate-500">Label:</span>{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {currentRecord.label}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Onset:</span>{" "}
              <span className="font-mono">{currentRecord.onset_seconds.toFixed(2)}s</span>
            </div>
            <div>
              <span className="text-slate-500">Subject:</span>{" "}
              <span>{currentRecord.subject_id}</span>
            </div>
          </div>
          <div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                currentRecord.qc_status === "VALID"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
            >
              QC: {currentRecord.qc_status}
            </span>
          </div>
        </div>
      )}

      {/* Waveform Canvas */}
      <div className="relative border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-950">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs text-indigo-400 z-10">
            Loading epoch signals...
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="w-full h-72 block"
        />
      </div>

      {/* Legend & Guide */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-slate-400/20 border border-slate-400 rounded-sm" />
            <span>Baseline Window</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-indigo-500/20 border border-indigo-500 rounded-sm" />
            <span>Analysis Window</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-0.5 bg-rose-500 border-dashed" />
            <span>Cue Onset (t=0s)</span>
          </div>
        </div>
        <div className="font-mono text-slate-400">Scale: +/-50 uV / slot</div>
      </div>
    </div>
  );
}
