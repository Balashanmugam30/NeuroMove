"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Activity, Play, Pause, Sparkles } from "lucide-react";
import { SignalQualityMetrics } from "@neuromove/contracts";
import { EEGRingBuffer } from "@/lib/realtime/EEGRingBuffer";
import { cn } from "@/lib/utils";

const CHANNEL_COLOR_MAP: Record<string, string> = {
  C3: "#2563EB", // Primary Blue
  Cz: "#0D9488", // Teal
  C4: "#7C3AED", // Violet
};

interface EEGOscilloscopeProps {
  channels?: string[];
  selectedChannel?: string;
  sampleRateHz?: number;
  activeIntent?: string;
  activeCue?: string;
  signalQuality?: SignalQualityMetrics | null;
  isRunning?: boolean;
  ringBuffer?: EEGRingBuffer | null;
  packetRate?: number;
  latencyMs?: number;
  className?: string;
}

export function EEGOscilloscope({
  channels = ["C3", "Cz", "C4"],
  selectedChannel = "ALL",
  sampleRateHz = 250,
  activeIntent = "NONE",
  activeCue = "REST",
  isRunning = true,
  ringBuffer,
  packetRate = 25,
  latencyMs = 1.2,
  className,
}: EEGOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timeWindowSec, setTimeWindowSec] = useState<number>(4);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverData, setHoverData] = useState<{ timeMs: number; valueUv: number; channel: string } | null>(null);

  // Channels to render based on selection filter
  const visibleChannels = useMemo(() => {
    if (selectedChannel === "ALL") return channels;
    return channels.filter((ch) => ch === selectedChannel);
  }, [channels, selectedChannel]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let fallbackPhase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Background
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;

      const numChannels = visibleChannels.length;
      const channelHeight = height / Math.max(1, numChannels);

      // Horizontal channel baselines
      visibleChannels.forEach((_, i) => {
        const y = channelHeight * i + channelHeight / 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Amplitude bounds dashed lines (+-30 uV guide)
        ctx.save();
        ctx.strokeStyle = "#F1F5F9";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y - channelHeight * 0.35);
        ctx.lineTo(width, y - channelHeight * 0.35);
        ctx.moveTo(0, y + channelHeight * 0.35);
        ctx.lineTo(width, y + channelHeight * 0.35);
        ctx.stroke();
        ctx.restore();
      });

      // Vertical time grid (divisions based on time window)
      const numDivisions = timeWindowSec;
      const xStep = width / numDivisions;
      for (let x = 0; x <= width; x += xStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw traces
      if (!isPaused && isRunning) {
        fallbackPhase += 0.05;
      }

      visibleChannels.forEach((ch, idx) => {
        const centerY = channelHeight * idx + channelHeight / 2;
        const color = CHANNEL_COLOR_MAP[ch] || "#2563EB";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const samplesToDisplay = timeWindowSec * sampleRateHz;
        const hasRingData = ringBuffer && ringBuffer.getTotalSamplesPushed() > 0;

        if (hasRingData) {
          const rawBuffer = ringBuffer.getOrderedChannelData(ch);
          const available = rawBuffer.length;
          const slice = rawBuffer.subarray(Math.max(0, available - samplesToDisplay));

          slice.forEach((val: number, sampleIdx: number) => {
            const x = (sampleIdx / Math.max(1, slice.length - 1)) * width;
            // Vertical scale: 1 uV maps to (channelHeight * 0.012) px
            const y = centerY - val * (channelHeight * 0.012);
            if (sampleIdx === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
        } else {
          // Synthetic fallback waveform preview when waiting for socket packets
          const totalPoints = 200;
          for (let p = 0; p < totalPoints; p++) {
            const t = p * (timeWindowSec / totalPoints) + fallbackPhase;
            const x = (p / (totalPoints - 1)) * width;
            const muAmp = activeIntent === "RIGHT" && ch === "C3" ? 6 : 18;
            const muVal = muAmp * Math.sin(2 * Math.PI * 10.0 * t);
            const betaVal = 6 * Math.sin(2 * Math.PI * 20.0 * t);
            const y = centerY - (muVal + betaVal) * (channelHeight * 0.012);

            if (p === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();

        // Channel Legend Label on left
        ctx.fillStyle = color;
        ctx.font = "bold 11px monospace";
        ctx.fillText(`${ch}`, 12, centerY - 14);

        ctx.fillStyle = "#64748B";
        ctx.font = "10px monospace";
        ctx.fillText("0 uV", 12, centerY + 12);
      });

      // Research cursor vertical tracking line
      if (cursorPos) {
        ctx.save();
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cursorPos.x, 0);
        ctx.lineTo(cursorPos.x, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#2563EB";
        ctx.fill();
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [
    visibleChannels,
    timeWindowSec,
    isPaused,
    isRunning,
    ringBuffer,
    sampleRateHz,
    activeIntent,
    cursorPos,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPos({ x, y });

    // Calculate time offset in ms
    const timeRatio = x / canvas.width;
    const timeMs = Math.round(timeRatio * timeWindowSec * 1000);

    // Identify hovered channel
    const channelHeight = canvas.height / Math.max(1, visibleChannels.length);
    const channelIdx = Math.min(
      visibleChannels.length - 1,
      Math.max(0, Math.floor(y / channelHeight))
    );
    const channel = visibleChannels[channelIdx] || "C3";

    // Estimate microvolts from baseline
    const centerY = channelHeight * channelIdx + channelHeight / 2;
    const deltaY = centerY - y;
    const valueUv = Math.round(deltaY / (channelHeight * 0.012));

    setHoverData({ timeMs, valueUv, channel });
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
    setHoverData(null);
  };

  return (
    <div
      data-testid="eeg-oscilloscope"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header with Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Continuous Electrophysiology
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Multi-Channel Electrophysiology Oscilloscope
              </h3>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                SYNTHETIC EEG
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar: Time Window Selector & Pause Button */}
        <div className="flex items-center gap-2">
          {/* Time Window Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-2xs font-mono">
            {[1, 2, 4, 8, 10].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setTimeWindowSec(sec)}
                className={cn(
                  "px-2 py-1 rounded font-bold transition-all",
                  timeWindowSec === sec
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Pause / Inspect Toggle */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors",
              isPaused
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                Inspect
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Trial & Event Annotations Bar */}
      <div className="mt-3 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-2xs text-slate-600 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-slate-900">
            <Sparkles className="w-3 h-3 text-blue-600" />
            Active Cue: {activeCue}
          </span>
          <span className="text-slate-400">|</span>
          <span>Cognitive Intent: {activeIntent}</span>
          <span className="hidden lg:inline text-slate-400">|</span>
          <span className="hidden lg:inline text-3xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            C3 (μ-Power 8-12Hz)
          </span>
          <span className="hidden lg:inline text-3xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
            C4 (μ-Power 8-12Hz)
          </span>
        </div>

        {hoverData && (
          <div className="flex items-center gap-2 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <span>Cursor: {hoverData.channel}</span>
            <span>{hoverData.timeMs} ms</span>
            <span>{hoverData.valueUv > 0 ? `+${hoverData.valueUv}` : hoverData.valueUv} uV</span>
          </div>
        )}
      </div>

      {/* Canvas Oscilloscope */}
      <div className="relative mt-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-80 block cursor-crosshair"
        />

        {/* Vertical Axis Calibration Tag */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-white/90 backdrop-blur-xs border border-slate-200 text-3xs font-mono text-slate-500 shadow-2xs">
          Vertical Scale: +-40 uV
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-mono text-slate-500">
        <div>
          <span className="text-slate-400">Sampling Rate: </span>
          <span className="font-semibold text-slate-700">{sampleRateHz} Hz</span>
        </div>
        <div>
          <span className="text-slate-400">Packet Rate: </span>
          <span className="font-semibold text-teal-700">{packetRate} pkts/s</span>
        </div>
        <div>
          <span className="text-slate-400">Window: </span>
          <span className="font-semibold text-slate-700">{timeWindowSec} seconds</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400">Transport: </span>
          <span className="font-semibold text-emerald-700">{latencyMs} ms IPC</span>
        </div>
      </div>
    </div>
  );
}
