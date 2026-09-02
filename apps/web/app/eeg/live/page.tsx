"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  EegAcquisitionSource,
  EegAcquisitionState,
  EegDeviceDescriptor,
  EegChannelHealthSnapshot,
  EegStreamHealthSnapshot,
  EegCalibrationSnapshot,
  EegLiveInferenceSummary,
  EegE2EResult,
} from "@neuromove/contracts";
import {
  fetchEegAcquisitionStatus,
  fetchEegAcquisitionDevices,
  fetchEegAcquisitionChannels,
  fetchEegAcquisitionHealth,
  fetchEegAcquisitionWaveforms,
  fetchEegAcquisitionCalibration,
  discoverEegAcquisitionDevices,
  setEegAcquisitionSource,
  connectEegAcquisitionDevice,
  disconnectEegAcquisitionDevice,
  pauseEegAcquisitionStream,
  resumeEegAcquisitionStream,
  runEegAcquisitionCalibration,
  runEegAcquisitionInference,
  runEegAcquisitionScenario,
  injectEegAcquisitionFault,
  resetEegAcquisitionLab,
} from "@/lib/api-client";
import {
  AcquisitionDevicePanel,
  LiveSignalWaveformPanel,
  ChannelQcMatrixPanel,
  StreamQualityTelemetryPanel,
  EegCalibrationPanel,
  LivePipelineInspector,
  E2EScenariosLab,
  GOLDEN_SCENARIOS,
} from "@/components/eeg-live";
import { RefreshCw, RotateCcw, Radio } from "lucide-react";

export default function LiveEegAcquisitionPage() {
  const [activeSource, setActiveSource] = useState<EegAcquisitionSource>("SIMULATOR");
  const [activeDeviceId, setActiveDeviceId] = useState<string>("sim_eeg_01");
  const [connectionState, setConnectionState] = useState<EegAcquisitionState>("STREAMING");
  const [devices, setDevices] = useState<EegDeviceDescriptor[]>([]);
  const [channelSnapshots, setChannelSnapshots] = useState<EegChannelHealthSnapshot[]>([]);
  const [streamHealth, setStreamHealth] = useState<EegStreamHealthSnapshot | null>(null);
  const [waveformData, setWaveformData] = useState<any>(null);
  const [calibration, setCalibration] = useState<EegCalibrationSnapshot | null>(null);
  const [inferenceSummary, setInferenceSummary] = useState<EegLiveInferenceSummary | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, EegE2EResult>>({});
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Load Initial Workspace Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statusRes, devicesRes, channelsRes, healthRes, waveformsRes, calRes] =
        await Promise.all([
          fetchEegAcquisitionStatus().catch(() => null),
          fetchEegAcquisitionDevices().catch(() => []),
          fetchEegAcquisitionChannels().catch(() => []),
          fetchEegAcquisitionHealth().catch(() => null),
          fetchEegAcquisitionWaveforms(250).catch(() => null),
          fetchEegAcquisitionCalibration().catch(() => null),
        ]);

      if (statusRes) {
        setActiveSource(statusRes.active_source);
        setActiveDeviceId(statusRes.active_device_id);
        setConnectionState(statusRes.health.state);
        setStreamHealth(statusRes.health);
      }
      if (devicesRes.length > 0) setDevices(devicesRes);
      if (channelsRes.length > 0) setChannelSnapshots(channelsRes);
      if (healthRes) setStreamHealth(healthRes);
      if (waveformsRes) setWaveformData(waveformsRes);
      if (calRes) setCalibration(calRes);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket Live Telemetry Connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/eeg/acquisition";
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "eeg_sample_packet" || data.type === "health_snapshot") {
              if (data.health) setStreamHealth(data.health);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
          ws?.close();
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Polling fallback for live waveforms & health
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isStreaming) return;
      try {
        const [waveformsRes, channelsRes, healthRes] = await Promise.all([
          fetchEegAcquisitionWaveforms(200).catch(() => null),
          fetchEegAcquisitionChannels().catch(() => []),
          fetchEegAcquisitionHealth().catch(() => null),
        ]);
        if (waveformsRes) setWaveformData(waveformsRes);
        if (channelsRes.length > 0) setChannelSnapshots(channelsRes);
        if (healthRes) {
          setStreamHealth(healthRes);
          setConnectionState(healthRes.state);
        }
      } catch {
        // Suppress background poll errors
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [isStreaming]);

  // Handlers
  const handleSelectSource = async (src: EegAcquisitionSource, devId?: string) => {
    try {
      setIsLoading(true);
      await setEegAcquisitionSource(src, devId);
      setActiveSource(src);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const res = await connectEegAcquisitionDevice();
      setConnectionState(res.state);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const res = await disconnectEegAcquisitionDevice();
      setConnectionState(res.state);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscover = async () => {
    try {
      setIsLoading(true);
      const devs = await discoverEegAcquisitionDevices();
      setDevices(devs);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStream = async () => {
    try {
      if (isStreaming) {
        await pauseEegAcquisitionStream();
        setIsStreaming(false);
      } else {
        await resumeEegAcquisitionStream();
        setIsStreaming(true);
      }
      const health = await fetchEegAcquisitionHealth();
      setStreamHealth(health);
      setConnectionState(health.state);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInjectFault = async (faultType: string, params?: Record<string, any>) => {
    try {
      await injectEegAcquisitionFault(faultType, params);
      const channels = await fetchEegAcquisitionChannels();
      setChannelSnapshots(channels);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunCalibration = async () => {
    try {
      setIsLoading(true);
      const cal = await runEegAcquisitionCalibration();
      setCalibration(cal);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunInference = async (intent?: string) => {
    try {
      setIsLoading(true);
      const inf = await runEegAcquisitionInference(intent);
      setInferenceSummary(inf);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunScenario = async (scenarioId: string) => {
    try {
      const res = await runEegAcquisitionScenario(scenarioId);
      setScenarioResults((prev) => ({ ...prev, [scenarioId]: res }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunAllScenarios = async () => {
    try {
      setIsLoading(true);
      for (const sc of GOLDEN_SCENARIOS) {
        const res = await runEegAcquisitionScenario(sc.id);
        setScenarioResults((prev) => ({ ...prev, [sc.id]: res }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetLab = async () => {
    try {
      setIsLoading(true);
      const health = await resetEegAcquisitionLab();
      setStreamHealth(health);
      setConnectionState(health.state);
      setScenarioResults({});
      setInferenceSummary(null);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Actions Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4" />
            <span>Phase 21 • Ingestion & Live Neurophysiology Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Real EEG / BioAmp Acquisition Laboratory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Unified acquisition interface linking physical BioAmps, synthetic motor-imagery simulators, and replay fixtures into the end-to-end safety & HIL pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* WebSocket Status */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              wsConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {wsConnected ? "Telemetry Live" : "Polling Mode"}
          </span>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Reset Workspace Button */}
          <button
            onClick={handleResetLab}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Lab
          </button>
        </div>
      </div>

      {/* Grid of Workstation Panels */}
      <div className="space-y-6">
        {/* 1. Device Acquisition Interface */}
        <AcquisitionDevicePanel
          activeSource={activeSource}
          activeDeviceId={activeDeviceId}
          connectionState={connectionState}
          devices={devices}
          onSelectSource={handleSelectSource}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onDiscover={handleDiscover}
          isLoading={isLoading}
        />

        {/* 2. Live Signal Waveforms Oscilloscope */}
        <LiveSignalWaveformPanel
          waveformData={waveformData}
          isStreaming={isStreaming}
          onToggleStream={handleToggleStream}
        />

        {/* 3. Channel QC Matrix & Impedance */}
        <ChannelQcMatrixPanel
          channelSnapshots={channelSnapshots}
          onInjectFault={handleInjectFault}
          isLoading={isLoading}
        />

        {/* 4. Stream Quality & Clock Sync Telemetry */}
        <StreamQualityTelemetryPanel health={streamHealth} />

        {/* 5. Live Calibration & Readiness Gate */}
        <EegCalibrationPanel
          calibration={calibration}
          onRunCalibration={handleRunCalibration}
          isLoading={isLoading}
        />

        {/* 6. Live Pipeline Stage Inspector & Intent Stimulation */}
        <LivePipelineInspector
          inferenceSummary={inferenceSummary}
          onRunInference={handleRunInference}
          isLoading={isLoading}
        />

        {/* 7. Golden E2E Verification Scenarios Lab */}
        <E2EScenariosLab
          scenarioResults={scenarioResults}
          onRunScenario={handleRunScenario}
          onRunAllScenarios={handleRunAllScenarios}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
