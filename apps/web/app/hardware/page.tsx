"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  HardwareStatus,
  SerialPortDescriptor,
  HardwareDiagnostic,
  HILExperiment,
  HILScenarioResult,
  HardwareEndpointMode,
  ExecutionAuthorization,
  CommandTrace,
} from "@neuromove/contracts";
import {
  fetchHardwareStatus,
  fetchHardwarePorts,
  discoverHardwarePorts,
  connectHardwareEndpoint,
  disconnectHardwareEndpoint,
  negotiateHardwareProtocol,
  validateHardwareAuthorization,
  runHardwareCommand,
  reconnectHardware,
  rebootHardwareDevice,
  fetchHILExperiments,
  replayHILExperiment,
  resetHardwareLab,
  fetchHardwareDiagnostics,
  runTransportScenario,
  pingTransportHeartbeat,
} from "@/lib/api-client";
import { DeviceOverviewCard } from "@/components/hardware/DeviceOverviewCard";
import { ConnectionNegotiationPanel } from "@/components/hardware/ConnectionNegotiationPanel";
import { CommandVerificationConsole } from "@/components/hardware/CommandVerificationConsole";
import { HILExperimentLab } from "@/components/hardware/HILExperimentLab";
import { HardwareTraceViewer } from "@/components/hardware/HardwareTraceViewer";
import { RecoveryDiagnosticsPanel } from "@/components/hardware/RecoveryDiagnosticsPanel";
import { Cpu, RefreshCw } from "lucide-react";

export default function HardwarePage() {
  const [status, setStatus] = useState<HardwareStatus | null>(null);
  const [ports, setPorts] = useState<SerialPortDescriptor[]>([]);
  const [diagnostics, setDiagnostics] = useState<HardwareDiagnostic[]>([]);
  const [experiments, setExperiments] = useState<HILExperiment[]>([]);
  const [traces, setTraces] = useState<CommandTrace[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statusRes, portsRes, diagRes, expRes] = await Promise.all([
        fetchHardwareStatus().catch(() => null),
        fetchHardwarePorts().catch(() => []),
        fetchHardwareDiagnostics().catch(() => []),
        fetchHILExperiments().catch(() => []),
      ]);

      if (statusRes) setStatus(statusRes);
      if (portsRes) setPorts(portsRes);
      if (diagRes) setDiagnostics(diagRes);
      if (expRes) setExperiments(expRes);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // WebSocket connection to /ws/hardware
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const port = "8000"; // FastAPI backend port
      const wsUrl = `${protocol}//${host}:${port}/ws/hardware`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "HARDWARE_STATUS_UPDATED" && data.payload) {
              setStatus((prev) => ({ ...prev, ...data.payload }));
            } else if (data.type === "HARDWARE_COMMAND_TRACE" && data.payload) {
              setTraces((prev) => [data.payload, ...prev.slice(0, 99)]);
            } else if (data.type === "HARDWARE_DIAGNOSTIC" && data.payload) {
              setDiagnostics((prev) => [data.payload, ...prev.slice(0, 49)]);
            }
          } catch {
            // Ignore parse errors on raw telemetry
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
          ws?.close();
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  // Handlers
  const handleDiscoverPorts = async () => {
    const discovered = await discoverHardwarePorts();
    setPorts(discovered);
  };

  const handleConnect = async (mode: HardwareEndpointMode, port?: string, baudRate?: number) => {
    const res = await connectHardwareEndpoint({
      device_mode: mode,
      port,
      baud_rate: baudRate,
    });
    if (res.status) setStatus(res.status);
    await loadInitialData();
  };

  const handleDisconnect = async () => {
    await disconnectHardwareEndpoint();
    await loadInitialData();
  };

  const handleNegotiate = async () => {
    await negotiateHardwareProtocol();
    await loadInitialData();
  };

  const handleValidate = async (auth: ExecutionAuthorization) => {
    return await validateHardwareAuthorization(auth);
  };

  const handleRunCommand = async (payload: {
    command_type: string;
    intent_class: string;
    subject_id: string;
    authorization: ExecutionAuthorization;
  }) => {
    const res = await runHardwareCommand(payload);
    await loadInitialData();
    return res;
  };

  const handlePingHeartbeat = async () => {
    await pingTransportHeartbeat();
    await loadInitialData();
  };

  const handleRebootDevice = async () => {
    await rebootHardwareDevice();
    await loadInitialData();
  };

  const handleReconnect = async () => {
    const newStatus = await reconnectHardware();
    setStatus(newStatus);
    await loadInitialData();
  };

  const handleResetLab = async () => {
    const resetStatus = await resetHardwareLab();
    setStatus(resetStatus);
    setTraces([]);
    await loadInitialData();
  };

  const handleRunScenario = async (scenarioId: string): Promise<HILScenarioResult> => {
    const res = await runTransportScenario(scenarioId);
    await loadInitialData();
    return res as unknown as HILScenarioResult;
  };

  const handleReplayExperiment = async (experimentId: string) => {
    await replayHILExperiment(experimentId);
    await loadInitialData();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Hardware-in-the-Loop (HIL) Laboratory</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Phase 20
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ESP32 protocol validation, deterministic simulation, and hardware abstraction boundary
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
              wsConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {wsConnected ? "WS LIVE" : "POLLING"}
          </span>

          <button
            onClick={loadInitialData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Device Overview Card */}
      <DeviceOverviewCard
        status={status}
        onRefresh={loadInitialData}
        isLoading={isLoading}
      />

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <ConnectionNegotiationPanel
            status={status}
            ports={ports}
            onDiscoverPorts={handleDiscoverPorts}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onNegotiate={handleNegotiate}
            isLoading={isLoading}
          />

          <CommandVerificationConsole
            status={status}
            onValidate={handleValidate}
            onRunCommand={handleRunCommand}
            isLoading={isLoading}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <RecoveryDiagnosticsPanel
            status={status}
            diagnostics={diagnostics}
            onPingHeartbeat={handlePingHeartbeat}
            onRebootDevice={handleRebootDevice}
            onReconnect={handleReconnect}
            onResetLab={handleResetLab}
            isLoading={isLoading}
          />

          <HardwareTraceViewer
            traces={traces}
            onClearTraces={() => setTraces([])}
          />
        </div>
      </div>

      {/* Bottom Full-Width HIL Scenarios Lab */}
      <HILExperimentLab
        experiments={experiments}
        onRunScenario={handleRunScenario}
        onReplayExperiment={handleReplayExperiment}
        isLoading={isLoading}
      />
    </div>
  );
}
