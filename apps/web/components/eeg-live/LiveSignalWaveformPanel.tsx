"use client";

import React, { useState } from "react";
import { Waves, Pause, Play, ZoomIn, ZoomOut, Eye, EyeOff } from "lucide-react";

interface WaveformWindowData {
  channels: string[];
  sample_count: number;
  sampling_rate: number;
  data: number[][];
  timestamp: string;
}

interface LiveSignalWaveformPanelProps {
  waveformData: WaveformWindowData | null;
  isStreaming: boolean;
  onToggleStream: () => void;
}

export const LiveSignalWaveformPanel: React.FC<LiveSignalWaveformPanelProps> = ({
  waveformData,
  isStreaming,
  onToggleStream,
}) => {
  const [scale, setScale] = useState<number>(50); // +/- 50 uV range
  const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>({
    C3: true,
    Cz: true,
    C4: true,
    FC1: true,
    FC2: true,
    CP1: true,
    CP2: true,
    Pz: true,
  });

  const channels = waveformData?.channels || ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"];
  const nSamples = waveformData?.sample_count || 100;

  const toggleChannel = (ch: string) => {
    setVisibleChannels((prev) => ({ ...prev, [ch]: !prev[ch] }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      {/* Panel Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Waves className="w-5 h-5 text-teal-600" />
            Live Multi-Channel EEG Oscilloscope
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime downsampled telemetry buffer • {waveformData?.sampling_rate || 250} Hz • ±{scale} µV scale
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setScale((s) => Math.max(20, s - 15))}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
              title="Zoom In (Decrease µV scale)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-600">±{scale}µV</span>
            <button
              onClick={() => setScale((s) => Math.min(200, s + 15))}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
              title="Zoom Out (Increase µV scale)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Pause / Freeze Toggle */}
          <button
            onClick={onToggleStream}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              isStreaming
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                : "bg-teal-600 text-white hover:bg-teal-700 border-teal-700 shadow-sm"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Freeze Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Resume Stream
              </>
            )}
          </button>
        </div>
      </div>

      {/* Channel Toggles Bar */}
      <div className="flex flex-wrap gap-2 pt-1 pb-2">
        {channels.map((ch) => {
          const isVis = visibleChannels[ch] !== false;
          return (
            <button
              key={ch}
              onClick={() => toggleChannel(ch)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium border flex items-center gap-1.5 transition-colors ${
                isVis
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
              }`}
            >
              {isVis ? <Eye className="w-3 h-3 text-teal-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
              {ch}
            </button>
          );
        })}
      </div>

      {/* SVG Waveform Multi-Trace Canvas */}
      <div className="bg-slate-950 rounded-lg p-4 relative overflow-hidden h-[340px] flex flex-col justify-between border border-slate-800">
        {/* Grid lines */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 opacity-10 pointer-events-none">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="border-r border-b border-teal-400" />
          ))}
        </div>

        <svg className="w-full h-full" viewBox={`0 0 ${Math.max(100, nSamples)} ${channels.length * 40}`} preserveAspectRatio="none">
          {channels.map((ch, chIdx) => {
            if (visibleChannels[ch] === false) return null;
            const chData = waveformData?.data?.[chIdx] || [];
            const yOffset = chIdx * 40 + 20;

            let pathD = "";
            if (chData.length > 0) {
              pathD = chData
                .map((val, sampleIdx) => {
                  const normalizedY = yOffset - (val / scale) * 16;
                  return `${sampleIdx === 0 ? "M" : "L"} ${sampleIdx} ${normalizedY}`;
                })
                .join(" ");
            } else {
              // Baseline fallback line
              pathD = `M 0 ${yOffset} L ${nSamples} ${yOffset}`;
            }

            return (
              <g key={ch}>
                {/* Channel baseline */}
                <line
                  x1="0"
                  y1={yOffset}
                  x2={nSamples}
                  y2={yOffset}
                  stroke="#334155"
                  strokeDasharray="2,4"
                  strokeWidth="0.5"
                />
                {/* Channel Label */}
                <text
                  x="4"
                  y={yOffset - 5}
                  fill="#0D9488"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {ch}
                </text>
                {/* Waveform trace */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={chIdx % 2 === 0 ? "#14B8A6" : "#38BDF8"}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Live Timestamp & Sample Counter */}
        <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
          Samples: {nSamples} • Updated: {waveformData?.timestamp ? new Date(waveformData.timestamp).toLocaleTimeString() : "--:--:--"}
        </div>
      </div>
    </div>
  );
};
