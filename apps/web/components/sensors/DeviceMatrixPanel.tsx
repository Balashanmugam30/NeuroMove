"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Power,
  ShieldCheck,
  Layers,
} from "lucide-react";
import type { SensorDeviceDescriptor, SensorHealthSnapshot } from "@neuromove/contracts";

interface DeviceMatrixPanelProps {
  devices: SensorDeviceDescriptor[];
  healths: Record<string, SensorHealthSnapshot>;
  onConnect: (deviceId: string) => Promise<void>;
  onDisconnect: (deviceId: string) => Promise<void>;
  onCalibrate: (deviceId: string) => Promise<void>;
  isLoading?: boolean;
}

export const DeviceMatrixPanel: React.FC<DeviceMatrixPanelProps> = ({
  devices,
  healths: _healths,
  onConnect,
  onDisconnect,
  onCalibrate,
  isLoading,
}) => {
  const [selectedModality, setSelectedModality] = useState<string>("ALL");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const modalities = ["ALL", "EEG", "IMU", "EMG", "EOG", "PPG", "PRESSURE", "AUXILIARY"];

  const filteredDevices =
    selectedModality === "ALL"
      ? devices
      : devices.filter((d) => d.modality === selectedModality);

  const handleAction = async (deviceId: string, action: "connect" | "disconnect" | "calibrate") => {
    setActionInProgress(`${deviceId}_${action}`);
    try {
      if (action === "connect") await onConnect(deviceId);
      else if (action === "disconnect") await onDisconnect(deviceId);
      else if (action === "calibrate") await onCalibrate(deviceId);
    } finally {
      setActionInProgress(null);
    }
  };

  const getModalityColor = (mod: string) => {
    switch (mod) {
      case "EEG":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "IMU":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "EMG":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "EOG":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "PPG":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "PRESSURE":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">Multimodal Sensor Matrix</h2>
            <span className="px-2 py-0.5 text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
              Phase 23 Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic sensor discovery, physical vs simulated device binding & calibration.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {modalities.map((mod) => (
            <button
              key={mod}
              onClick={() => setSelectedModality(mod)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedModality === mod
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((dev) => {
          const isBusy = actionInProgress?.startsWith(dev.device_id);

          return (
            <div
              key={dev.device_id}
              className={`border rounded-lg p-4 bg-slate-950/60 transition-all ${
                dev.is_connected
                  ? "border-cyan-500/40 shadow-sm shadow-cyan-950/30"
                  : "border-slate-800 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border ${getModalityColor(dev.modality)}`}>
                      {dev.modality}
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                      {dev.source}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 mt-1.5">{dev.name}</h3>
                  <div className="text-xs font-mono text-slate-500">{dev.device_id}</div>
                </div>

                <div className="flex items-center gap-1">
                  {dev.is_connected ? (
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
                      <XCircle className="w-3.5 h-3.5" /> Disconnected
                    </span>
                  )}
                </div>
              </div>

              {/* Hardware / Stream Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/80 p-2.5 rounded border border-slate-800/80 mb-3">
                <div>
                  <span className="text-slate-500">Channels:</span>{" "}
                  <span className="text-slate-200">{dev.channel_count} ({dev.channel_names?.slice(0, 3).join(", ")}{dev.channel_count > 3 ? "..." : ""})</span>
                </div>
                <div>
                  <span className="text-slate-500">Rate:</span>{" "}
                  <span className="text-cyan-400">{dev.default_sampling_rate} Hz</span>
                </div>
                <div>
                  <span className="text-slate-500">Protocol:</span>{" "}
                  <span className="text-slate-300">{dev.protocol}</span>
                </div>
                <div>
                  <span className="text-slate-500">Avail:</span>{" "}
                  <span className={dev.is_available ? "text-emerald-400" : "text-rose-400"}>
                    {dev.is_available ? "Ready" : "Unavailable"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                {dev.is_connected ? (
                  <>
                    <button
                      onClick={() => handleAction(dev.device_id, "disconnect")}
                      disabled={isBusy || isLoading}
                      className="flex-1 py-1.5 px-2.5 text-xs font-medium bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Power className="w-3.5 h-3.5" /> Disconnect
                    </button>
                    <button
                      onClick={() => handleAction(dev.device_id, "calibrate")}
                      disabled={isBusy || isLoading}
                      className="py-1.5 px-3 text-xs font-medium bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Calibrate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction(dev.device_id, "connect")}
                    disabled={isBusy || isLoading || !dev.is_available}
                    className="w-full py-1.5 px-2.5 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Power className="w-3.5 h-3.5" /> Connect Sensor
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
