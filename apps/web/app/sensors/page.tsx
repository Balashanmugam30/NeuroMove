"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  fetchSensorDevices,
  connectSensorDevice,
  disconnectSensorDevice,
  calibrateSensorDevice,
  fetchSensorsHealth,
  fetchSensorsSyncState,
  startSensorSession,
  stopSensorSession,
  fetchMultimodalFrame,
  processSensorInference,
  injectSensorFault,
  clearSensorFaults,
  fetchSensorScenarios,
  runSensorScenario,
  resetMultimodalService,
} from "@/lib/api-client";
import type {
  SensorDeviceDescriptor,
  SensorHealthSnapshot,
  MultimodalSyncState,
  MultimodalContext,
  FusionResult,
} from "@neuromove/contracts";
import { DeviceMatrixPanel } from "@/components/sensors/DeviceMatrixPanel";
import { SyncAlignmentPanel } from "@/components/sensors/SyncAlignmentPanel";
import { SensorQualityPanel } from "@/components/sensors/SensorQualityPanel";
import { MultimodalSignalOscilloscope } from "@/components/sensors/MultimodalSignalOscilloscope";
import { SensorFusionPanel } from "@/components/sensors/SensorFusionPanel";
import { ContextEnginePanel } from "@/components/sensors/ContextEnginePanel";
import { MultimodalPipelineFlow } from "@/components/sensors/MultimodalPipelineFlow";
import { MultimodalFaultLab } from "@/components/sensors/MultimodalFaultLab";
import { MultimodalScenariosPanel } from "@/components/sensors/MultimodalScenariosPanel";

export default function MultimodalSensorsPage() {
  const [devices, setDevices] = useState<SensorDeviceDescriptor[]>([]);
  const [healths, setHealths] = useState<Record<string, SensorHealthSnapshot>>({});
  const [syncState, setSyncState] = useState<MultimodalSyncState | null>(null);
  const [context, setContext] = useState<MultimodalContext | null>(null);
  const [fusion, setFusion] = useState<FusionResult | null>(null);
  const [packets, setPackets] = useState<Record<string, any>>({});
  const [inferenceResult, setInferenceResult] = useState<Record<string, any> | null>(null);
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [devList, healthMap, syncData, scenarioList] = await Promise.all([
        fetchSensorDevices(),
        fetchSensorsHealth(),
        fetchSensorsSyncState(),
        fetchSensorScenarios(),
      ]);
      setDevices(devList);
      setHealths(healthMap);
      setSyncState(syncData);
      setScenarios(scenarioList);
    } catch (err: any) {
      setError(err.message || "Failed to load multimodal sensors data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Polling loop for active live streaming
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStreaming) {
      interval = setInterval(async () => {
        try {
          const frame = await fetchMultimodalFrame({ chunk_size: 10, candidate_intent: "FORWARD", eeg_confidence: 0.92 });
          setPackets(frame.packets);
          setContext(frame.context);
          setFusion(frame.fusion);
          setSyncState(frame.sync);

          const inf = await processSensorInference("FORWARD", 0.92);
          setInferenceResult(inf);
        } catch {
          // Keep running
        }
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  const handleConnect = async (deviceId: string) => {
    await connectSensorDevice(deviceId);
    await loadInitialData();
  };

  const handleDisconnect = async (deviceId: string) => {
    await disconnectSensorDevice(deviceId);
    await loadInitialData();
  };

  const handleCalibrate = async (deviceId: string) => {
    await calibrateSensorDevice(deviceId);
    await loadInitialData();
  };

  const handleStartStream = async () => {
    setIsStreaming(true);
    await startSensorSession("session_web_multimodal");
  };

  const handleStopStream = async () => {
    setIsStreaming(false);
    await stopSensorSession();
  };

  const handleInjectFault = async (sensorId: string, faultType: string) => {
    await injectSensorFault(sensorId, faultType);
    const frame = await fetchMultimodalFrame({ chunk_size: 10 });
    setPackets(frame.packets);
    setContext(frame.context);
    setFusion(frame.fusion);
    setSyncState(frame.sync);
    const inf = await processSensorInference("FORWARD", 0.92);
    setInferenceResult(inf);
  };

  const handleClearFaults = async () => {
    await clearSensorFaults();
    const frame = await fetchMultimodalFrame({ chunk_size: 10 });
    setPackets(frame.packets);
    setContext(frame.context);
    setFusion(frame.fusion);
    setSyncState(frame.sync);
    const inf = await processSensorInference("FORWARD", 0.92);
    setInferenceResult(inf);
  };

  const handleRunScenario = async (scenarioId: string) => {
    const res = await runSensorScenario(scenarioId);
    if (res.data) {
      setInferenceResult(res.data);
    }
    return res;
  };

  const handleReset = async () => {
    setIsStreaming(false);
    await resetMultimodalService();
    await loadInitialData();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-teal-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  Multimodal Sensors & Fusion Engine
                </h1>
                <span className="px-2.5 py-0.5 text-2xs font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
                  Phase 23
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Advanced acquisition across EEG, IMU, EMG, EOG, PPG & Pressure with deterministic clock synchronization and non-actuating context verification.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isStreaming ? (
            <button
              onClick={handleStopStream}
              className="py-2 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2 shadow-2xs transition-colors"
            >
              <Square className="w-4 h-4" /> Stop Live Stream
            </button>
          ) : (
            <button
              onClick={handleStartStream}
              className="py-2 px-4 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2 shadow-2xs transition-colors"
            >
              <Play className="w-4 h-4" /> Start Multimodal Stream
            </button>
          )}

          <button
            onClick={loadInitialData}
            disabled={isLoading}
            className="py-2 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-teal-600" : ""}`} /> Refresh
          </button>

          <button
            onClick={handleReset}
            className="py-2 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            Reset Service
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Canonical Pipeline Architecture Flow */}
      <MultimodalPipelineFlow inferenceResult={inferenceResult} />

      {/* 2. Sensor Device Matrix & Discovery */}
      <DeviceMatrixPanel
        devices={devices}
        healths={healths}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onCalibrate={handleCalibrate}
        isLoading={isLoading}
      />

      {/* 3. Real-Time Oscilloscope Waveforms */}
      <MultimodalSignalOscilloscope packets={packets} isStreaming={isStreaming} />

      {/* 4. Synchronization & Quality Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SyncAlignmentPanel syncState={syncState} />
        <SensorQualityPanel healths={healths} />
      </div>

      {/* 5. Sensor Fusion & Context Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SensorFusionPanel fusionResult={fusion} />
        <ContextEnginePanel context={context} />
      </div>

      {/* 6. Resilience Fault Injection Lab */}
      <MultimodalFaultLab
        onInjectFault={handleInjectFault}
        onClearFaults={handleClearFaults}
        isLoading={isLoading}
      />

      {/* 7. 12 Golden Verification Scenarios */}
      <MultimodalScenariosPanel
        scenarios={scenarios}
        onRunScenario={handleRunScenario}
        isLoading={isLoading}
      />
    </div>
  );
}
