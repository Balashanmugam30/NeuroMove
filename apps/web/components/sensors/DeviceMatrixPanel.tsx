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
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "IMU":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "EMG":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "EOG":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "PPG":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "PRESSURE":
        return "bg-teal-50 text-teal-700 border-teal-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Multimodal Sensor Matrix</h2>
            <span className="px-2 py-0.5 text-2xs font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded">
              Phase 23 Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic sensor discovery, physical vs simulated device binding & calibration.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {modalities.map((mod) => (
            <button
              key={mod}
              onClick={() => setSelectedModality(mod)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                selectedModality === mod
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
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
              className={`border rounded-xl p-4 bg-white transition-all shadow-2xs ${
                dev.is_connected
                  ? "border-teal-400 ring-1 ring-teal-100"
                  : "border-slate-200 opacity-90"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-2xs font-mono font-bold rounded border ${getModalityColor(dev.modality)}`}>
                      {dev.modality}
                    </span>
                    <span className="text-2xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {dev.source}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{dev.name}</h3>
                  <div className="text-2xs font-mono text-slate-400">{dev.device_id}</div>
                </div>

                <div className="flex items-center gap-1">
                  {dev.is_connected ? (
                    <span className="flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-2xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <XCircle className="w-3.5 h-3.5 text-slate-400" /> Disconnected
                    </span>
                  )}
                </div>
              </div>

              {/* Hardware / Stream Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3">
                <div>
                  <span className="text-slate-500">Channels:</span>{" "}
                  <span className="text-slate-800 font-semibold">{dev.channel_count} ({dev.channel_names?.slice(0, 3).join(", ")}{dev.channel_count > 3 ? "..." : ""})</span>
                </div>
                <div>
                  <span className="text-slate-500">Rate:</span>{" "}
                  <span className="text-teal-700 font-bold">{dev.default_sampling_rate} Hz</span>
                </div>
                <div>
                  <span className="text-slate-500">Protocol:</span>{" "}
                  <span className="text-slate-800">{dev.protocol}</span>
                </div>
                <div>
                  <span className="text-slate-500">Avail:</span>{" "}
                  <span className={dev.is_available ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                    {dev.is_available ? "Ready" : "Unavailable"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                {dev.is_connected ? (
                  <>
                    <button
                      onClick={() => handleAction(dev.device_id, "disconnect")}
                      disabled={isBusy || isLoading}
                      className="flex-1 py-1.5 px-2.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                    >
                      <Power className="w-3.5 h-3.5" /> Disconnect
                    </button>
                    <button
                      onClick={() => handleAction(dev.device_id, "calibrate")}
                      disabled={isBusy || isLoading}
                      className="py-1.5 px-3 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Calibrate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction(dev.device_id, "connect")}
                    disabled={isBusy || isLoading || !dev.is_available}
                    className="w-full py-1.5 px-2.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
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
