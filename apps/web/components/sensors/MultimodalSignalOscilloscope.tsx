"use client";

import React from "react";
import { Activity, Radio } from "lucide-react";

interface MultimodalSignalOscilloscopeProps {
  packets: Record<string, any>;
  isStreaming?: boolean;
}

export const MultimodalSignalOscilloscope: React.FC<MultimodalSignalOscilloscopeProps> = ({
  packets,
  isStreaming = false,
}) => {
  const packetList = Object.values(packets);

  const renderWaveform = (data: number[], color: string, height: number = 36) => {
    if (!data || data.length === 0) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * 100;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg className="w-full h-9 overflow-visible" preserveAspectRatio="none" viewBox={`0 0 100 ${height}`}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Multimodal Signal Oscilloscope</h2>
            {isStreaming && (
              <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
                <Radio className="w-3 h-3 text-emerald-600" /> LIVE STREAMING
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time synchronized visualization across EEG ($\mu$V), IMU ($m/s^2, ^\circ/s$), EMG bursts, EOG blinks, and Pressure (kPa).
          </p>
        </div>
      </div>

      {packetList.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono text-slate-500">
          No active stream packets. Start a streaming session to visualize live waveforms.
        </div>
      ) : (
        <div className="space-y-4">
          {packetList.map((pkt: any) => {
            const modality = pkt.modality;
            const channelNames = pkt.channel_names || [];
            const dataMatrix: number[][] = pkt.data || [];

            return (
              <div
                key={pkt.sensor_id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {pkt.sensor_id}
                    </span>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-bold">
                      {modality} ({pkt.units})
                    </span>
                  </div>
                  <div className="text-2xs font-mono text-slate-500">
                    Seq: #{pkt.sequence_number} | Samples: {pkt.sample_count}
                  </div>
                </div>

                {/* Waveform Strip Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {channelNames.map((chName: string, idx: number) => {
                    const chData = dataMatrix[idx] || [];
                    const latestVal = chData.length > 0 ? chData[chData.length - 1] : 0;

                    let color = "#38bdf8"; // cyan
                    if (modality === "IMU") color = idx < 3 ? "#f59e0b" : "#a855f7"; // amber accel, purple gyro
                    else if (modality === "EMG") color = "#10b981"; // emerald
                    else if (modality === "EOG") color = "#ec4899"; // pink
                    else if (modality === "PPG") color = "#f43f5e"; // rose
                    else if (modality === "PRESSURE") color = "#3b82f6"; // blue

                    return (
                      <div
                        key={chName}
                        className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-2xs font-mono">
                          <span className="text-slate-600 font-bold">{chName}</span>
                          <span className="text-slate-900 font-semibold">{latestVal.toFixed(2)} {pkt.units}</span>
                        </div>
                        <div className="h-9 w-full bg-slate-950 rounded flex items-center justify-center overflow-hidden px-1 shadow-inner">
                          {renderWaveform(chData, color)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
