"use client";

import React, { useState, useRef, useEffect } from "react";
import { LineChart, Download, RefreshCw } from "lucide-react";
import { PSDResponse, PSDMethod } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

const CHANNEL_COLOR_MAP: Record<string, string> = {
  C3: "#2563EB", // Blue
  Cz: "#0D9488", // Teal
  C4: "#7C3AED", // Violet
};

interface PSDChartProps {
  psdData?: PSDResponse | null;
  selectedChannel?: string;
  onMethodChange?: (method: PSDMethod) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function PSDChart({
  psdData,
  selectedChannel = "ALL",
  onMethodChange,
  onRefresh,
  onExport,
  isLoading = false,
  className,
}: PSDChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeMethod, setActiveMethod] = useState<PSDMethod>("welch");

  const handleMethodToggle = (method: PSDMethod) => {
    setActiveMethod(method);
    onMethodChange?.(method);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 30, bottom: 40, left: 55 };

    // Clear
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, width, height);

    if (!psdData || !psdData.frequencies || psdData.frequencies.length === 0) {
      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No PSD data available for current window", width / 2, height / 2);
      return;
    }

    const freqs = psdData.frequencies;
    const fmin = freqs[0] || 1;
    const fmax = freqs[freqs.length - 1] || 40;

    // Determine max power across visible channels
    const channelsToDraw =
      selectedChannel === "ALL"
        ? Object.keys(psdData.psd_by_channel)
        : [selectedChannel].filter((c) => c in psdData.psd_by_channel);

    let maxPower = 1.0;
    channelsToDraw.forEach((ch) => {
      const arr = psdData.psd_by_channel[ch] || [];
      const m = Math.max(...arr, 1.0);
      if (m > maxPower) maxPower = m;
    });

    // Add 15% headroom
    maxPower *= 1.15;

    // Draw Grid & Axes
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;

    // Horizontal power grid lines
    const numYGrid = 5;
    for (let i = 0; i <= numYGrid; i++) {
      const yVal = (maxPower / numYGrid) * i;
      const y = height - padding.bottom - (i / numYGrid) * (height - padding.top - padding.bottom);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = "#64748B";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(yVal.toFixed(1), padding.left - 8, y + 3);
    }

    // Vertical frequency grid lines
    const freqSteps = [1, 5, 10, 15, 20, 25, 30, 35, 40];
    freqSteps.forEach((f) => {
      if (f >= fmin && f <= fmax) {
        const xRatio = (f - fmin) / (fmax - fmin);
        const x = padding.left + xRatio * (width - padding.left - padding.right);

        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();

        ctx.fillStyle = "#64748B";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${f}`, x, height - padding.bottom + 16);
      }
    });

    // Axis Labels
    ctx.fillStyle = "#475569";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", width / 2, height - 8);

    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Power Spectral Density (uV^2/Hz)", 0, 0);
    ctx.restore();

    // Draw Frequency Band Shading (Mu Band 8-13 Hz)
    const muStartRatio = (8 - fmin) / (fmax - fmin);
    const muEndRatio = (13 - fmin) / (fmax - fmin);
    const muX1 = padding.left + muStartRatio * (width - padding.left - padding.right);
    const muX2 = padding.left + muEndRatio * (width - padding.left - padding.right);
    ctx.fillStyle = "rgba(37, 99, 235, 0.05)";
    ctx.fillRect(muX1, padding.top, muX2 - muX1, height - padding.top - padding.bottom);

    // Label Mu band
    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 9px monospace";
    ctx.fillText("MU (8-13 Hz)", (muX1 + muX2) / 2, padding.top + 14);

    // Draw Channel Curves
    channelsToDraw.forEach((ch) => {
      const curve = psdData.psd_by_channel[ch] || [];
      const color = CHANNEL_COLOR_MAP[ch] || "#2563EB";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      curve.forEach((pwr, idx) => {
        const f = freqs[idx];
        const x = padding.left + ((f - fmin) / (fmax - fmin)) * (width - padding.left - padding.right);
        const y = height - padding.bottom - (pwr / maxPower) * (height - padding.top - padding.bottom);

        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
  }, [psdData, selectedChannel]);

  return (
    <div
      data-testid="psd-chart"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
            <LineChart className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Frequency Domain Analysis
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Power Spectral Density (PSD)
              </h3>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                MNE-PYTHON
              </span>
            </div>
          </div>
        </div>

        {/* Method Switcher & Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-2xs font-mono">
            <button
              type="button"
              onClick={() => handleMethodToggle("welch")}
              className={cn(
                "px-2.5 py-1 rounded font-bold transition-all",
                activeMethod === "welch"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Welch
            </button>
            <button
              type="button"
              onClick={() => handleMethodToggle("multitaper")}
              className={cn(
                "px-2.5 py-1 rounded font-bold transition-all",
                activeMethod === "multitaper"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Multitaper
            </button>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Recalculate PSD"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-2xs font-semibold text-slate-700 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
        <canvas
          ref={canvasRef}
          width={750}
          height={260}
          className="w-full h-64 block"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Legend & Peak Frequencies */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-2xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span className="text-slate-700 font-bold">C3:</span>
            <span className="text-slate-500">
              Peak {psdData?.peak_frequencies?.["C3"] ?? 10.0} Hz
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
            <span className="text-slate-700 font-bold">Cz:</span>
            <span className="text-slate-500">
              Peak {psdData?.peak_frequencies?.["Cz"] ?? 10.0} Hz
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
            <span className="text-slate-700 font-bold">C4:</span>
            <span className="text-slate-500">
              Peak {psdData?.peak_frequencies?.["C4"] ?? 10.0} Hz
            </span>
          </div>
        </div>

        <div className="text-slate-400">
          Units: {psdData?.units || "uV^2/Hz"} | Range: 1-40 Hz
        </div>
      </div>
    </div>
  );
}
