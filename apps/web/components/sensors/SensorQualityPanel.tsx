"use client";

import React from "react";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { SensorHealthSnapshot } from "@neuromove/contracts";

interface SensorQualityPanelProps {
  healths: Record<string, SensorHealthSnapshot>;
}

export const SensorQualityPanel: React.FC<SensorQualityPanelProps> = ({ healths }) => {
  const sensorList = Object.values(healths);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">Sensor Quality Control & Health Matrix</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Modality-aware anomaly detection inspecting SNR, saturation, flatline, dropout, and sequence integrity.
          </p>
        </div>
      </div>

      {sensorList.length === 0 ? (
        <div className="text-center py-8 text-xs font-mono text-slate-500">
          No active streaming sensors registered. Connect a sensor in the matrix above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensorList.map((h) => (
            <div
              key={h.sensor_id}
              className="border border-slate-800 bg-slate-950/60 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {h.sensor_id}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {h.modality}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 mt-0.5">
                    Jitter: {h.jitter_ms?.toFixed(2) ?? "0.00"} ms | Loss: {((h.packet_loss_rate ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>

                <div>
                  {h.is_healthy ? (
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" /> Degraded
                    </span>
                  )}
                </div>
              </div>

              {/* Channel Quality Bars */}
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-slate-400 flex justify-between">
                  <span>Channel Health Matrix</span>
                  <span>Usable: {h.channels.filter((c) => c.is_usable).length} / {h.channels.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {h.channels.map((ch) => (
                    <div
                      key={ch.channel_name}
                      className={`p-2 rounded border text-xs font-mono ${
                        ch.is_usable
                          ? "bg-slate-900 border-slate-800 text-slate-300"
                          : "bg-rose-950/20 border-rose-800/40 text-rose-400"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{ch.channel_name}</span>
                        <span>{ch.qc_status}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        SNR: {ch.snr_db.toFixed(1)} dB
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Mean: {ch.mean_amplitude.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Flags / Anomaly Badges */}
              {h.active_anomalies.length > 0 && (
                <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                  {h.active_anomalies.map((flag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" /> {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
