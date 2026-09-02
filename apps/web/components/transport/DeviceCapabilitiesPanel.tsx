"use client";

import React, { useState } from "react";
import {
  Cpu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power,
  Radio,
} from "lucide-react";
import { DeviceIdentity } from "@neuromove/contracts";

interface DeviceCapabilitiesPanelProps {
  device: DeviceIdentity | null;
  onNegotiate: (version: string) => Promise<any>;
  onResetSimulation: () => Promise<any>;
  isLoading?: boolean;
}

const ALL_CAPABILITIES = [
  { id: "COMMAND_RECEIVE", label: "Command Reception", desc: "Accepts binary framed command envelopes" },
  { id: "COMMAND_ACK", label: "Positive ACK", desc: "Generates COMMAND_ACCEPTED and duplicate responses" },
  { id: "COMMAND_NACK", label: "Negative NACK", desc: "Generates structured retryable/non-retryable errors" },
  { id: "HEARTBEAT", label: "Heartbeat Ping/Pong", desc: "Responds to periodic link-liveness telemetry" },
  { id: "STATUS_REPORT", label: "Status Telemetry", desc: "Reports buffer, error, and sequence counters" },
  { id: "SAFE_STOP", label: "Abstract Safe Stop", desc: "Receives software stop commands (simulation only)" },
  { id: "SIMULATION", label: "Simulation Mode", desc: "Strictly executes in pure software simulation" },
];

export function DeviceCapabilitiesPanel({
  device,
  onNegotiate,
  onResetSimulation,
  isLoading = false,
}: DeviceCapabilitiesPanelProps) {
  const [testVersion, setTestVersion] = useState<string>("1.0");
  const [negotiateResult, setNegotiateResult] = useState<any | null>(null);

  const handleNegotiate = async () => {
    try {
      const res = await onNegotiate(testVersion);
      setNegotiateResult(res);
    } catch (err: any) {
      setNegotiateResult({ success: false, reason: err.message });
    }
  };

  const deviceCaps = device?.capabilities?.map((c) => String(c)) || [];

  return (
    <div className="space-y-5 font-sans">
      {/* Device Descriptor Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Endpoint Hardware-Abstraction Descriptor
              </h4>
              <p className="text-xs text-slate-500">
                Simulated ESP32 identity, boot nonce, and advertised capabilities
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetSimulation}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Power className="w-3.5 h-3.5 text-red-500" />
            Simulate Cold Reboot (Reset Boot ID)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Device Identifier</span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
              {device?.device_id || "esp32_sim_01"}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Boot Nonce</span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block truncate">
              {device?.boot_id || "boot_init"}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Firmware String</span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
              {device?.firmware_version || "esp32-neuromove-v0.1.0"}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Protocol Baseline</span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
              v{device?.protocol_version || "1.0"}
            </span>
          </div>
        </div>
      </div>

      {/* Capabilities Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">
            Advertised Device Capability Matrix
          </h4>
          <span className="text-xs text-slate-500">
            {deviceCaps.length} of {ALL_CAPABILITIES.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_CAPABILITIES.map((cap) => {
            const isSupported = deviceCaps.includes(cap.id);
            return (
              <div
                key={cap.id}
                className={`p-3 rounded-lg border transition-all ${
                  isSupported
                    ? "bg-emerald-50/40 border-emerald-200/80"
                    : "bg-slate-50 border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-slate-900">{cap.id}</span>
                  {isSupported ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> SUPPORTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                      <XCircle className="w-3 h-3 text-slate-400" /> DISABLED
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-800">{cap.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{cap.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Handshake & Version Negotiation Sandbox */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Protocol Version Handshake Sandbox
            </h4>
          </div>
          <span className="text-xs text-slate-500">
            Test backward compatibility & major version rejection
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-48">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Client Protocol Version
            </label>
            <input
              type="text"
              value={testVersion}
              onChange={(e) => setTestVersion(e.target.value)}
              placeholder="e.g. 1.0 or 2.0"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="pt-5">
            <button
              type="button"
              onClick={handleNegotiate}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Perform 3-Way Handshake
            </button>
          </div>
        </div>

        {negotiateResult && (
          <div
            className={`p-3 rounded-lg border text-xs space-y-1 font-mono ${
              negotiateResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 font-sans">
              {negotiateResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              {negotiateResult.success
                ? `Negotiation Succeeded (v${negotiateResult.negotiated_version})`
                : "Negotiation Rejected"}
            </div>
            <p className="text-[11px] opacity-90">{negotiateResult.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
