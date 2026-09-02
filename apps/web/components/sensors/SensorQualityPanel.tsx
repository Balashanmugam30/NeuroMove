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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Sensor Quality Control & Health Matrix</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
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
              className="border border-slate-200 bg-slate-50 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {h.sensor_id}
                    </span>
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-semibold">
                      {h.modality}
                    </span>
                  </div>
                  <div className="text-2xs font-mono text-slate-500 mt-0.5">
                    Jitter: {h.jitter_ms?.toFixed(2) ?? "0.00"} ms | Loss: {((h.packet_loss_rate ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>

                <div>
                  {h.is_healthy ? (
                    <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Healthy
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-2xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" /> Degraded
                    </span>
                  )}
                </div>
              </div>

              {/* Channel Quality Bars */}
              <div className="space-y-1.5">
                <div className="text-2xs font-mono font-bold text-slate-500 flex justify-between">
                  <span>Channel Health Matrix</span>
                  <span>Usable: {h.channels.filter((c) => c.is_usable).length} / {h.channels.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {h.channels.map((ch) => (
                    <div
                      key={ch.channel_name}
                      className={`p-2 rounded-lg border text-2xs font-mono ${
                        ch.is_usable
                          ? "bg-white border-slate-200 text-slate-800 shadow-2xs"
                          : "bg-rose-50 border-rose-200 text-rose-700"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{ch.channel_name}</span>
                        <span>{ch.qc_status}</span>
                      </div>
                      <div className="text-3xs text-slate-500 mt-1">
                        SNR: {ch.snr_db.toFixed(1)} dB
                      </div>
                      <div className="text-3xs text-slate-500">
                        Mean: {ch.mean_amplitude.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Flags / Anomaly Badges */}
              {h.active_anomalies.length > 0 && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                  {h.active_anomalies.map((flag, idx) => (
                    <span
                      key={idx}
                      className="text-3xs font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> {flag}
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
