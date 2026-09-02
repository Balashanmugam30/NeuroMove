"use client";

import React, { useState } from "react";
import {
  HardwareStatus,
  HardwareEndpointMode,
  SerialPortDescriptor,
} from "@neuromove/contracts";
import {
  Cable,
  Search,
  CheckCircle2,
  PlugZap,
  PowerOff,
  Handshake,
  Loader2,
  Layers,
} from "lucide-react";

interface ConnectionNegotiationPanelProps {
  status: HardwareStatus | null;
  ports: SerialPortDescriptor[];
  onDiscoverPorts: () => Promise<void>;
  onConnect: (mode: HardwareEndpointMode, port?: string, baudRate?: number) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onNegotiate: () => Promise<void>;
  isLoading?: boolean;
}

export function ConnectionNegotiationPanel({
  status,
  ports,
  onDiscoverPorts,
  onConnect,
  onDisconnect,
  onNegotiate,
  isLoading,
}: ConnectionNegotiationPanelProps) {
  const [selectedMode, setSelectedMode] = useState<HardwareEndpointMode>(
    status?.active_mode || "SIMULATOR"
  );
  const [selectedPort, setSelectedPort] = useState<string>(
    ports.length > 0 ? ports[0].port : "VIRTUAL_COM_01"
  );
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const isConnected = status?.connection_state === "READY" || status?.connection_state === "CONNECTED";

  const handleModeChange = (mode: HardwareEndpointMode) => {
    setSelectedMode(mode);
    if (mode === "VIRTUAL_SERIAL") {
      setSelectedPort("VIRTUAL_COM_01");
    } else if (mode === "SIMULATOR") {
      setSelectedPort("SIMULATED_ENDPOINT");
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      await onConnect(selectedMode, selectedPort, baudRate);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await onDisconnect();
    } finally {
      setActionLoading(false);
    }
  };

  const handleNegotiate = async () => {
    setActionLoading(true);
    try {
      await onNegotiate();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-sans">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Cable className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              Connection & Protocol Negotiation
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Discovery, handshake, session management & capability exchange
            </p>
          </div>
        </div>

        <button
          onClick={onDiscoverPorts}
          disabled={isLoading || actionLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          Scan Ports
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Endpoint Mode Switcher */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Target Endpoint Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { mode: "SIMULATOR" as HardwareEndpointMode, label: "Simulator (In-Memory)", desc: "Zero OS overhead" },
              { mode: "VIRTUAL_SERIAL" as HardwareEndpointMode, label: "Virtual Serial (CI)", desc: "Duplex byte stream" },
              { mode: "HIL_ESP32" as HardwareEndpointMode, label: "Physical ESP32", desc: "UART / USB Serial" },
            ].map(({ mode, label, desc }) => {
              const isSelected = selectedMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold">{label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Port & Baud Rate Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Communication Port
            </label>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={selectedMode === "SIMULATOR"}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            >
              {ports.map((p) => (
                <option key={p.port} value={p.port}>
                  {p.port} ({p.description})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Baud Rate
            </label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={selectedMode !== "HIL_ESP32"}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            >
              {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
                <option key={b} value={b}>
                  {b} bps
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {!isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={actionLoading || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
                Connect & Switch Mode
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={actionLoading || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            )}

            <button
              type="button"
              onClick={handleNegotiate}
              disabled={actionLoading || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Handshake className="w-3.5 h-3.5" />
              Negotiate Protocol (v1.0)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Session ID:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {status?.session_id || "None"}
            </span>
          </div>
        </div>

        {/* Advertised Capabilities */}
        {status?.device?.capabilities && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Advertised Device Capabilities
            </div>
            <div className="flex flex-wrap gap-1.5">
              {status.device.capabilities.map((cap) => (
                <span key={cap} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
