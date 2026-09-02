"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Radio,
  Send,
  Activity,
  Layers,
  Cpu,
  FlaskConical,
  RotateCcw,
} from "lucide-react";
import {
  TransportLabStatus,
  CommandTrace,
  TransportMetrics,
  ExecutionAuthorization,
} from "@neuromove/contracts";
import {
  fetchTransportStatus,
  fetchTransportCommands,
  fetchTransportTraces,
  fetchTransportMetrics,
  fetchTransportScenarios,
  reconnectTransport,
  pingTransportHeartbeat,
  sendTransportCommand,
  cancelTransportCommand,
  negotiateTransportProtocol,
  resetTransportSimulation,
  injectTransportFault,
  runTransportScenario,
} from "@/lib/api-client";
import { LinkStatusCard } from "@/components/transport/LinkStatusCard";
import { CommandConsole } from "@/components/transport/CommandConsole";
import { ProtocolTraceViewer } from "@/components/transport/ProtocolTraceViewer";
import { ReliabilityMetricsCard } from "@/components/transport/ReliabilityMetricsCard";
import { DeviceCapabilitiesPanel } from "@/components/transport/DeviceCapabilitiesPanel";
import { TransportSimulationLab } from "@/components/transport/TransportSimulationLab";

type TransportTab =
  | "OVERVIEW"
  | "CONSOLE"
  | "TRACES"
  | "RELIABILITY"
  | "DEVICE"
  | "SIMULATION";

export default function TransportPage() {
  const [activeTab, setActiveTab] = useState<TransportTab>("OVERVIEW");

  const [status, setStatus] = useState<TransportLabStatus | null>(null);
  const [commands, setCommands] = useState<any[]>([]);
  const [traces, setTraces] = useState<CommandTrace[]>([]);
  const [metrics, setMetrics] = useState<TransportMetrics | null>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [_errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, cmdsRes, tracesRes, metricsRes, scenariosRes] = await Promise.all([
        fetchTransportStatus().catch(() => null),
        fetchTransportCommands().catch(() => []),
        fetchTransportTraces().catch(() => []),
        fetchTransportMetrics().catch(() => null),
        fetchTransportScenarios().catch(() => []),
      ]);

      if (statusRes) setStatus(statusRes);
      setCommands(cmdsRes);
      setTraces(tracesRes);
      if (metricsRes) setMetrics(metricsRes);
      setScenarios(scenariosRes);
    } catch (err) {
      console.error("Failed to load transport protocol state:", err);
      setErrorMessage("Could not load transport protocol telemetry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleReconnect = async () => {
    setIsActionLoading(true);
    try {
      await reconnectTransport();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePingHeartbeat = async () => {
    setIsActionLoading(true);
    try {
      await pingTransportHeartbeat();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSendCommand = async (auth: ExecutionAuthorization) => {
    const res = await sendTransportCommand(auth);
    await loadData();
    return res;
  };

  const handleCancelCommand = async (commandId: string) => {
    const res = await cancelTransportCommand(commandId);
    await loadData();
    return res;
  };

  const handleNegotiate = async (version: string) => {
    const res = await negotiateTransportProtocol({ protocol_version: version });
    await loadData();
    return res;
  };

  const handleResetSimulation = async () => {
    setIsActionLoading(true);
    try {
      await resetTransportSimulation();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleInjectFaults = async (faults: any) => {
    const res = await injectTransportFault(faults);
    await loadData();
    return res;
  };

  const handleRunScenario = async (scenarioId: string) => {
    const res = await runTransportScenario(scenarioId);
    await loadData();
    return res;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Command Transport & ESP32 Protocol Layer
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Phase 19
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Deterministic framing, CRC-32 integrity, monotonic sequencing, bounded retries & simulated ESP32 endpoint
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetSimulation}
            disabled={isActionLoading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset Transport Lab
          </button>
        </div>
      </div>

      {/* Global Link Status Summary Card */}
      <LinkStatusCard
        status={status}
        onReconnect={handleReconnect}
        onPingHeartbeat={handlePingHeartbeat}
        isActionLoading={isActionLoading}
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto text-xs font-medium text-slate-600 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("OVERVIEW")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "OVERVIEW"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Overview & Link Status
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CONSOLE")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "CONSOLE"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Command Console
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TRACES")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "TRACES"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Protocol Packet Trace ({traces.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RELIABILITY")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "RELIABILITY"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Reliability & Metrics
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEVICE")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "DEVICE"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Device & Capabilities
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SIMULATION")}
          className={`py-2.5 px-4 font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === "SIMULATION"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Simulation & Scenarios
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          <ReliabilityMetricsCard metrics={metrics} />

          {/* Architecture Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                Upstream Handshake
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Phase 17 Safety Gate Invariance
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Only explicit SafetyDecision.AUTHORIZED contracts construct wire frames. Denied, held, or emergency-stopped intents are strictly stopped prior to transmission.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
                Wire Encapsulation
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Binary Framing & CRC-32
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Wire format guarantees 0xAA55 start and 0x55AA end markers, big-endian length bounds, and IEEE 802.3 CRC-32 checksums for zero undetectable corruption.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                Downstream Handoff
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Phase 20 Hardware Abstraction
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                TransportAdapter encapsulates all simulated and physical endpoint interactions, preparing seamlessly for Phase 20 Hardware-in-the-Loop validation.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "CONSOLE" && (
        <CommandConsole
          onSendCommand={handleSendCommand}
          onCancelCommand={handleCancelCommand}
          commands={commands}
          isLoading={isActionLoading}
        />
      )}

      {activeTab === "TRACES" && (
        <ProtocolTraceViewer traces={traces} isLoading={isLoading} />
      )}

      {activeTab === "RELIABILITY" && (
        <ReliabilityMetricsCard metrics={metrics} />
      )}

      {activeTab === "DEVICE" && (
        <DeviceCapabilitiesPanel
          device={status?.device || null}
          onNegotiate={handleNegotiate}
          onResetSimulation={handleResetSimulation}
          isLoading={isActionLoading}
        />
      )}

      {activeTab === "SIMULATION" && (
        <TransportSimulationLab
          scenarios={scenarios}
          onRunScenario={handleRunScenario}
          onInjectFaults={handleInjectFaults}
          onResetSimulation={handleResetSimulation}
          isLoading={isActionLoading}
        />
      )}
    </div>
  );
}
