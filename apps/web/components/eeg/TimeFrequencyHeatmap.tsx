"use client";

import React, { useState, useRef, useEffect } from "react";
import { Clock, Download, RefreshCw } from "lucide-react";
import { TFRResponse } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

interface TimeFrequencyHeatmapProps {
  tfrData?: TFRResponse | null;
  selectedChannel?: string;
  onChannelChange?: (channel: string) => void;
  onCompute?: (channel: string) => void;
  onExportJson?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function TimeFrequencyHeatmap({
  tfrData,
  selectedChannel = "C3",
  onChannelChange,
  onCompute,
  onExportJson,
  isLoading = false,
  className,
}: TimeFrequencyHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>(selectedChannel);

  const handleChannelSelect = (ch: string) => {
    setActiveChannel(ch);
    onChannelChange?.(ch);
    onCompute?.(ch);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 15, right: 25, bottom: 35, left: 45 };

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, width, height);

    if (
      !tfrData ||
      !tfrData.power_matrix ||
      tfrData.power_matrix.length === 0 ||
      !tfrData.times ||
      tfrData.times.length === 0
    ) {
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Select analysis window to compute Morlet TFR", width / 2, height / 2);
      return;
    }

    const matrix = tfrData.power_matrix; // freqs x times
    const nFreqs = matrix.length;
    const nTimes = matrix[0].length;
    const freqs = tfrData.frequencies;
    const times = tfrData.times;

    // Find max power in matrix
    let maxPower = 0.01;
    for (let f = 0; f < nFreqs; f++) {
      for (let t = 0; t < nTimes; t++) {
        if (matrix[f][t] > maxPower) maxPower = matrix[f][t];
      }
    }

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const cellWidth = plotWidth / nTimes;
    const cellHeight = plotHeight / nFreqs;

    // Color gradient mapping function: from light teal (low) to deep indigo/blue (high)
    const getColor = (val: number, max: number) => {
      const ratio = Math.min(1.0, Math.max(0.0, val / max));
      // Color interpolation: Low (#E0F2FE) -> Med (#0D9488) -> High (#1E1B4B)
      const r = Math.round(224 * (1 - ratio) + 30 * ratio);
      const g = Math.round(242 * (1 - ratio) + 27 * ratio);
      const b = Math.round(254 * (1 - ratio) + 75 * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Render cells (frequencies plotted bottom-to-top)
    for (let f = 0; f < nFreqs; f++) {
      // Invert Y so lowest frequency is at bottom
      const y = padding.top + (nFreqs - 1 - f) * cellHeight;
      for (let t = 0; t < nTimes; t++) {
        const x = padding.left + t * cellWidth;
        const pwr = matrix[f][t];
        ctx.fillStyle = getColor(pwr, maxPower);
        ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
      }
    }

    // Grid & Axis labels
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // X Axis (Time)
    ctx.fillStyle = "#64748B";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const timeTicks = [0, 1, 2, 3, 4];
    timeTicks.forEach((tickSec) => {
      if (times.length > 0 && tickSec <= times[times.length - 1]) {
        const x = padding.left + (tickSec / times[times.length - 1]) * plotWidth;
        ctx.fillText(`${tickSec}s`, x, height - padding.bottom + 16);
      }
    });

    ctx.fillStyle = "#475569";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Time (seconds)", width / 2, height - 6);

    // Y Axis (Frequency)
    ctx.textAlign = "right";
    const freqTicks = [5, 10, 20, 30, 40];
    freqTicks.forEach((f) => {
      if (freqs.length > 0 && f >= freqs[0] && f <= freqs[freqs.length - 1]) {
        const fRatio = (f - freqs[0]) / (freqs[freqs.length - 1] - freqs[0]);
        const y = padding.top + (1 - fRatio) * plotHeight;
        ctx.fillText(`${f} Hz`, padding.left - 6, y + 3);
      }
    });
  }, [tfrData]);

  return (
    <div
      data-testid="time-frequency-heatmap"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Time-Frequency Representation
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Morlet Wavelet Spectrogram
              </h3>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                TFR MORLET
              </span>
            </div>
          </div>
        </div>

        {/* Channel Selector & Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-2xs font-mono">
            {["C3", "Cz", "C4"].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelSelect(ch)}
                className={cn(
                  "px-2.5 py-1 rounded font-bold transition-all",
                  activeChannel === ch
                    ? "bg-white text-purple-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {ch}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-2xs font-semibold text-slate-700 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Heatmap Canvas */}
      <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
        <canvas
          ref={canvasRef}
          width={750}
          height={240}
          className="w-full h-60 block"
        />

        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-2xs font-mono text-slate-500">
        <div>
          Target Channel: <span className="font-bold text-slate-800">{activeChannel}</span> | Method: Morlet Wavelet
        </div>
        <div className="text-slate-400">
          Range: 4-40 Hz | Bounded 4.0s Window
        </div>
      </div>
    </div>
  );
}
