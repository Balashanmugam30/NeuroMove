"use client";

import React from "react";
import {
  EegAcquisitionSource,
  EegAcquisitionState,
  EegDeviceDescriptor,
} from "@neuromove/contracts";
import {
  Radio,
  Cpu,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  ShieldCheck,
} from "lucide-react";

interface AcquisitionDevicePanelProps {
  activeSource: EegAcquisitionSource;
  activeDeviceId: string;
  connectionState: EegAcquisitionState;
  devices: EegDeviceDescriptor[];
  onSelectSource: (source: EegAcquisitionSource, deviceId?: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDiscover: () => void;
  isLoading?: boolean;
}

export const AcquisitionDevicePanel: React.FC<AcquisitionDevicePanelProps> = ({
  activeSource,
  connectionState,
  devices,
  onSelectSource,
  onConnect,
  onDisconnect,
  onDiscover,
  isLoading = false,
}) => {
  const isConnected = connectionState === "STREAMING" || connectionState === "CONFIGURING" || connectionState === "CALIBRATING";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-600" />
            EEG Acquisition Source & Device Interface
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select physical BioAmp ADC, synthetic motor-imagery generator, or recorded fixture replay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              connectionState === "STREAMING"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : connectionState === "ERROR"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}
          >
            {connectionState === "STREAMING" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {connectionState}
          </span>
          <button
            onClick={onDiscover}
            disabled={isLoading}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            title="Scan for Devices"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Non-Actuation Research Disclosure Banner */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3.5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-900 space-y-0.5">
          <p className="font-semibold">Laboratory Ingestion Boundary (Non-Actuation Guarantee)</p>
          <p className="text-blue-800/90 leading-relaxed">
            Physical EEG acquisition is strictly an inbound telemetry stream. No physical motors, PWM drivers,
            or wheelchair actuators are energized. Downstream commands route exclusively to the Phase 20 HIL endpoint.
          </p>
        </div>
      </div>

      {/* Source Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onSelectSource("SIMULATOR")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            activeSource === "SIMULATOR"
              ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600/30"
              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Synthetic Simulator</span>
          </div>
          <p className="text-xs text-slate-500">
            Deterministic sensorimotor rhythm generator (mu/beta ERD/ERS).
          </p>
        </button>

        <button
          onClick={() => onSelectSource("RECORDED")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            activeSource === "RECORDED"
              ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600/30"
              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Recorded Fixture</span>
          </div>
          <p className="text-xs text-slate-500">
            SHA-256 hashed compact replay fixture with zero sensitive data.
          </p>
        </button>

        <button
          onClick={() => onSelectSource("PHYSICAL")}
          className={`flex flex-col items-start p-3.5 rounded-lg border text-left transition-all ${
            activeSource === "PHYSICAL"
              ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600/30"
              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Physical BioAmp</span>
          </div>
          <p className="text-xs text-slate-500">
            Real USB/UART/LSL hardware boundary (honest availability check).
          </p>
        </button>
      </div>

      {/* Discovered Devices List */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Available Endpoints ({devices.length})
        </label>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {devices.map((dev) => {
            const isTarget = dev.source_type === activeSource;
            return (
              <div
                key={dev.device_id}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  isTarget ? "bg-blue-50/20" : "bg-white"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{dev.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {dev.source_type}
                    </span>
                    {!dev.is_available && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Not Detected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>Vendor: {dev.vendor || "N/A"}</span>
                    <span>•</span>
                    <span>Channels: {dev.channel_count}</span>
                    <span>•</span>
                    <span>Sampling: {dev.default_sampling_rate} Hz</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isTarget && isConnected ? (
                    <button
                      onClick={onDisconnect}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  ) : isTarget ? (
                    <button
                      onClick={onConnect}
                      disabled={!dev.is_available}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
