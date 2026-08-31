"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, Radio, Info, Zap } from "lucide-react";
import { SignalQualityMetrics } from "@neuromove/contracts";
import { EEGRingBuffer } from "@/lib/realtime/EEGRingBuffer";

interface EEGOscilloscopeProps {
  channels?: string[];
  sampleRateHz?: number;
  activeIntent?: string;
  signalQuality?: SignalQualityMetrics | null;
  isRunning?: boolean;
  ringBuffer?: EEGRingBuffer | null;
  packetRate?: number;
  latencyMs?: number;
}

export function EEGOscilloscope({
  channels = ["C3", "Cz", "C4"],
  sampleRateHz = 250,
  activeIntent = "NONE",
  signalQuality,
  isRunning = true,
  ringBuffer,
  packetRate = 25,
  latencyMs = 1.2,
}: EEGOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [muPowerC3, setMuPowerC3] = useState(12.4);
  const [muPowerC4, setMuPowerC4] = useState(13.1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear with clean health-tech background
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;

      // Horizontal channel baseline grids
      const channelHeight = height / channels.length;
      channels.forEach((_, i) => {
        const y = channelHeight * i + channelHeight / 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });

      // Vertical time grid (every 50px)
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (isRunning) {
        time += 0.04;

        // Dynamic SMR modulation based on active cognitive intent
        let c3Amp = 18;
        let c4Amp = 18;
        if (activeIntent === "RIGHT") {
          c3Amp = 6; // C3 contralateral desynchronization
          c4Amp = 22;
        } else if (activeIntent === "LEFT") {
          c4Amp = 6; // C4 contralateral desynchronization
          c3Amp = 22;
        }

        setMuPowerC3(c3Amp * 0.8);
        setMuPowerC4(c4Amp * 0.8);

        // Draw multi-channel traces
        const channelColors = ["#2563EB", "#0D9488", "#7C3AED"];

        channels.forEach((ch, idx) => {
          const centerY = channelHeight * idx + channelHeight / 2;
          ctx.strokeStyle = channelColors[idx % channelColors.length];
          ctx.lineWidth = 1.5;
          ctx.beginPath();

          const hasBufferedData =
            ringBuffer && ringBuffer.getTotalSamplesPushed() > 0;
          const channelBuffer = hasBufferedData
            ? ringBuffer.getOrderedChannelData(ch)
            : null;

          for (let x = 0; x < width; x++) {
            let y: number;
            if (channelBuffer && channelBuffer.length > 0) {
              const sampleIdx = Math.floor(
                (x / width) * Math.min(width, channelBuffer.length)
              );
              const val = channelBuffer[sampleIdx] || 0;
              y = centerY - val * 2.5;
            } else {
              const t = (x / width) * 4 + time;
              const amp = ch === "C3" ? c3Amp : ch === "C4" ? c4Amp : 14;
              const mu = amp * Math.sin(2 * Math.PI * 10.0 * (t * 0.05));
              const beta =
                amp * 0.4 * Math.sin(2 * Math.PI * 20.0 * (t * 0.05));
              const noise = (Math.random() - 0.5) * 4;
              y = centerY + mu + beta + noise;
            }

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        });
      } else {
        // Flatline resting state when paused / stopped
        channels.forEach((_, idx) => {
          const centerY = channelHeight * idx + channelHeight / 2;
          ctx.strokeStyle = "#94A3B8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(width, centerY);
          ctx.stroke();
        });
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [channels, isRunning, activeIntent, ringBuffer]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Multi-Channel Electrophysiology Oscilloscope
              </h3>
              <span className="px-2 py-0.5 text-2xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                SYNTHETIC EEG
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Sensorimotor rhythm (μ / β band) waveform synthesis @ {sampleRateHz} Hz
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
          <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            {isRunning ? "STREAMING" : "IDLE"} | {sampleRateHz} Hz | 3 Channels
          </div>
          {packetRate > 0 && (
            <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1 text-2xs font-semibold">
              <Zap className="w-3 h-3" />
              {packetRate} pkts/s ({latencyMs.toFixed(1)}ms)
            </div>
          )}
        </div>
      </div>

      {/* Scope Canvas Area */}
      <div className="relative rounded-lg overflow-hidden border border-slate-200">
        {/* Channel Labels Overlay */}
        <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-around pointer-events-none z-10">
          {channels.map((ch) => (
            <span
              key={ch}
              className="text-xs font-mono font-bold px-1.5 py-0.5 bg-white/90 backdrop-blur-xs text-slate-700 rounded shadow-2xs border border-slate-200"
            >
              {ch}
            </span>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={240}
          className="w-full h-60 block"
        />
      </div>

      {/* SMR Spectral Power & ERD/ERS Indicator Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
        <div className="p-2.5 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">C3 (μ-Power 8-12Hz)</span>
            <span className="font-mono font-semibold text-blue-600">
              {muPowerC3.toFixed(1)} μV²
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (muPowerC3 / 25) * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">C4 (μ-Power 8-12Hz)</span>
            <span className="font-mono font-semibold text-teal-600">
              {muPowerC4.toFixed(1)} μV²
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-teal-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (muPowerC4 / 25) * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">Signal Quality Score</span>
            <span className="font-mono font-semibold text-emerald-600">
              {((signalQuality?.overall_score ?? 0.94) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(signalQuality?.overall_score ?? 0.94) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scientific Disclaimer Footer */}
      <div className="mt-3 flex items-start gap-1.5 p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-2xs text-amber-800">
        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong>Scientific Disclaimer:</strong> Synthetic EEG signals are generated via mathematical oscillators for pipeline and latency validation. They do not represent measured clinical data.
        </span>
      </div>
    </div>
  );
}
