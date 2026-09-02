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
      color: "border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100",
      btnColor: "bg-white border-amber-300 text-amber-900 hover:bg-amber-50",
    },
    {
      id: "BLINK",
      sensorId: "sensor_eog_sim",
      title: "EOG Blink Pulse",
      description: "Injects ocular artifact spike concurrent with EEG intent decoding window.",
      icon: Eye,
      color: "border-pink-200 text-pink-800 bg-pink-50 hover:bg-pink-100",
      btnColor: "bg-white border-pink-300 text-pink-900 hover:bg-pink-50",
    },
    {
      id: "DROPOUT",
      sensorId: "sensor_eeg_sim",
      title: "EEG Channel Dropout",
      description: "Forces zero-amplitude signal loss triggering QC channel degradation.",
      icon: XCircle,
      color: "border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100",
      btnColor: "bg-white border-rose-300 text-rose-900 hover:bg-rose-50",
    },
    {
      id: "FLATLINE",
      sensorId: "sensor_eeg_sim",
      title: "Sensor Flatline",
      description: "Injects zero-variance constant signal violating physiological bounds.",
      icon: AlertTriangle,
      color: "border-orange-200 text-orange-800 bg-orange-50 hover:bg-orange-100",
      btnColor: "bg-white border-orange-300 text-orange-900 hover:bg-orange-50",
    },
    {
      id: "DISCONNECT",
      sensorId: "sensor_imu_sim",
      title: "IMU Hardware Disconnect",
      description: "Simulates sudden cable unplug or RF packet loss during streaming.",
      icon: ShieldAlert,
      color: "border-purple-200 text-purple-800 bg-purple-50 hover:bg-purple-100",
      btnColor: "bg-white border-purple-300 text-purple-900 hover:bg-purple-50",
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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">Resilience Fault Laboratory</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inject physiological and hardware anomalies to test contradiction gating, degradation handling, and fail-safe recovery.
          </p>
        </div>

        <button
          onClick={onClearFaults}
          disabled={isLoading}
          className="py-1.5 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
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
              className={`border rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-colors shadow-2xs ${f.color}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <div className="text-xs font-bold text-slate-900">{f.title}</div>
                </div>
                <p className="text-2xs text-slate-600 mt-1 leading-relaxed">
                  {f.description}
                </p>
              </div>

              <button
                onClick={() => handleInject(f.sensorId, f.id)}
                disabled={isLoading || isBusy}
                className={`w-full py-1.5 px-2 text-xs font-mono font-bold rounded-lg border transition-colors disabled:opacity-50 shadow-2xs ${f.btnColor}`}
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
