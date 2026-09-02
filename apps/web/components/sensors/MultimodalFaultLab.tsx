"use client";

import React, { useState } from "react";
import { AlertTriangle, Eye, Move, RefreshCw, XCircle, ShieldAlert } from "lucide-react";

interface MultimodalFaultLabProps {
  onInjectFault: (sensorId: string, faultType: string) => Promise<void>;
  onClearFaults: () => Promise<void>;
  isLoading?: boolean;
}

export const MultimodalFaultLab: React.FC<MultimodalFaultLabProps> = ({
  onInjectFault,
  onClearFaults,
  isLoading = false,
}) => {
  const [activeFault, setActiveFault] = useState<string | null>(null);

  const faults = [
    {
      id: "MOTION_BURST",
      sensorId: "sensor_imu_sim",
      title: "IMU Motion Burst",
      description: "Injects sudden violent head/chassis acceleration (> 20 m/s^2) during intent.",
      icon: Move,
      color: "border-amber-500/30 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40",
    },
    {
      id: "BLINK",
      sensorId: "sensor_eog_sim",
      title: "EOG Blink Pulse",
      description: "Injects ocular artifact spike concurrent with EEG intent decoding window.",
      icon: Eye,
      color: "border-pink-500/30 text-pink-400 bg-pink-950/20 hover:bg-pink-950/40",
    },
    {
      id: "DROPOUT",
      sensorId: "sensor_eeg_sim",
      title: "EEG Channel Dropout",
      description: "Forces zero-amplitude signal loss triggering QC channel degradation.",
      icon: XCircle,
      color: "border-rose-500/30 text-rose-400 bg-rose-950/20 hover:bg-rose-950/40",
    },
    {
      id: "FLATLINE",
      sensorId: "sensor_eeg_sim",
      title: "Sensor Flatline",
      description: "Injects zero-variance constant signal violating physiological bounds.",
      icon: AlertTriangle,
      color: "border-orange-500/30 text-orange-400 bg-orange-950/20 hover:bg-orange-950/40",
    },
    {
      id: "DISCONNECT",
      sensorId: "sensor_imu_sim",
      title: "IMU Hardware Disconnect",
      description: "Simulates sudden cable unplug or RF packet loss during streaming.",
      icon: ShieldAlert,
      color: "border-purple-500/30 text-purple-400 bg-purple-950/20 hover:bg-purple-950/40",
    },
  ];

  const handleInject = async (sensorId: string, faultType: string) => {
    setActiveFault(faultType);
    try {
      await onInjectFault(sensorId, faultType);
    } finally {
      setActiveFault(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-100">Resilience Fault Laboratory</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inject physiological and hardware anomalies to test contradiction gating, degradation handling, and fail-safe recovery.
          </p>
        </div>

        <button
          onClick={onClearFaults}
          disabled={isLoading}
          className="py-1.5 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Clear All Faults
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {faults.map((f) => {
          const Icon = f.icon;
          const isBusy = activeFault === f.id;

          return (
            <div
              key={f.id}
              className={`border rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition-colors ${f.color}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <div className="text-xs font-bold text-slate-200">{f.title}</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {f.description}
                </p>
              </div>

              <button
                onClick={() => handleInject(f.sensorId, f.id)}
                disabled={isLoading || isBusy}
                className="w-full py-1.5 px-2 text-xs font-mono font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isBusy ? "Injecting..." : "Inject Fault"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
