"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { RealtimeStatusBadge } from "@/components/ui/RealtimeStatusBadge";
import { EEGRingBuffer } from "@/lib/realtime/EEGRingBuffer";
import {
  fetchSimulationStatus,
  fetchPSD,
  fetchBandPower,
  fetchTFR,
  getExportPsdUrl,
  getExportBandPowerUrl,
  getExportAnalysisUrl,
} from "@/lib/api-client";
import {
  SimulationStatus,
  PSDResponse,
  BandPowerResponse,
  TFRResponse,
  PSDMethod,
} from "@neuromove/contracts";
import { EEGSourceSummaryCard } from "@/components/eeg/EEGSourceSummaryCard";
import { EEGChannelTopology } from "@/components/eeg/EEGChannelTopology";
import { ChannelSelector } from "@/components/eeg/ChannelSelector";
import { EEGOscilloscope } from "@/components/eeg/EEGOscilloscope";
import { SignalQualityPanel } from "@/components/eeg/SignalQualityPanel";
import { PSDChart } from "@/components/eeg/PSDChart";
import { BandPowerComparison } from "@/components/eeg/BandPowerComparison";
import { TimeFrequencyHeatmap } from "@/components/eeg/TimeFrequencyHeatmap";
import { PreprocessingOverview } from "@/components/eeg/PreprocessingOverview";
import { AnalysisProvenanceFooter } from "@/components/eeg/AnalysisProvenanceFooter";
import { Download } from "lucide-react";

export default function EEGLaboratoryPage() {
  const { operatingMode } = useMode();
  const { connectionState, latencyMs, latestSnapshot } = useRealtime();

  // Bounded 1000-sample ring buffer for 250 Hz continuous multi-channel stream (4 seconds memory)
  const ringBufferRef = useRef<EEGRingBuffer>(new EEGRingBuffer(1000, ["C3", "Cz", "C4"]));

  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [packetCount, setPacketCount] = useState<number>(0);
  const [packetRate, setPacketRate] = useState<number>(25);
  const lastPacketCountRef = useRef<number>(0);

  // Authoritative simulation context
  const [simStatus, setSimStatus] = useState<SimulationStatus>({
    is_running: true,
    is_paused: false,
    mode: "SIMULATION",
    scenario_id: "right-turn",
    scenario_name: "2. Right Turn Motor Imagery",
    seed: 42,
    speed: 1.0,
    elapsed_seconds: 0,
    total_duration_seconds: 10,
    current_intent: "NONE",
    current_cue: "REST",
    runtime_state: "READY",
    safety_decision: "STOP",
    active_faults: [],
  });

  // Scientific Analysis States
  const [psdData, setPsdData] = useState<PSDResponse | null>(null);
  const [bandData, setBandData] = useState<BandPowerResponse | null>(null);
  const [tfrData, setTfrData] = useState<TFRResponse | null>(null);
  const [isComputingAnalysis, setIsComputingAnalysis] = useState<boolean>(false);

  // Ingest high-frequency EEG transport packets
  useRealtimeStream("eeg", (msg) => {
    if (msg.payload && msg.payload.channels) {
      ringBufferRef.current.pushChunk(msg.payload.channels);
      setPacketCount((c) => c + 1);
    }
  });

  // Sync snapshot
  useEffect(() => {
    if (latestSnapshot?.simulation_status) {
      setSimStatus((prev) => ({
        ...prev,
        ...latestSnapshot.simulation_status,
      }));
    }
  }, [latestSnapshot]);

  // Compute transport packet delivery rate per second
  useEffect(() => {
    const rateInterval = setInterval(() => {
      const diff = packetCount - lastPacketCountRef.current;
      lastPacketCountRef.current = packetCount;
      if (diff > 0) setPacketRate(diff);
    }, 1000);

    return () => clearInterval(rateInterval);
  }, [packetCount]);

  // Load baseline simulation status & trigger initial MNE analyses
  const runSpectralAnalyses = async (method: PSDMethod = "welch", targetChannel: string = "C3") => {
    setIsComputingAnalysis(true);
    try {
      const [psd, bp, tfr] = await Promise.all([
        fetchPSD({
          channels: ["C3", "Cz", "C4"],
          method,
          fmin: 1.0,
          fmax: 40.0,
          window_duration_seconds: 4.0,
        }),
        fetchBandPower({
          channels: ["C3", "Cz", "C4"],
          method,
          window_duration_seconds: 4.0,
        }),
        fetchTFR({
          channel: targetChannel === "ALL" ? "C3" : targetChannel,
          fmin: 4.0,
          fmax: 40.0,
          window_duration_seconds: 4.0,
        }),
      ]);

      setPsdData(psd);
      setBandData(bp);
      setTfrData(tfr);
    } catch {
      // Graceful fallback for offline dev/tests
    } finally {
      setIsComputingAnalysis(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const st = await fetchSimulationStatus();
        setSimStatus(st);
      } catch {
        // Dev fallback
      }
      await runSpectralAnalyses("welch", "C3");
    };
    init();
  }, []);

  // Export handlers
  const handleExportPsd = () => {
    window.open(getExportPsdUrl(), "_blank");
  };

  const handleExportBandPower = () => {
    window.open(getExportBandPowerUrl(), "_blank");
  };

  const handleExportAnalysisJson = () => {
    window.open(getExportAnalysisUrl("ses_sim_001"), "_blank");
  };

  const isConnected = connectionState === "CONNECTED" || connectionState === "STREAMING";

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <PageHeader
        category="BCI Electrophysiology"
        title="EEG Laboratory"
        description="Realtime signal inspection, spectral analysis, and channel diagnostics."
        mode={operatingMode}
      />

      {/* Global Toolbar: Scenario, Session, Channel Filter & Realtime Status */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold">
            <span>SCENARIO:</span>
            <span>{simStatus.scenario_name}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <span>TRIAL:</span>
            <span className="font-bold">trl_001</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <span>SAMPLING:</span>
            <span className="font-bold text-teal-700">250 Hz</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChannelSelector
            channels={["C3", "Cz", "C4"]}
            selectedChannel={selectedChannel}
            onSelectChannel={(ch) => setSelectedChannel(ch)}
          />

          <RealtimeStatusBadge />

          <button
            type="button"
            onClick={handleExportAnalysisJson}
            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Level 1: Electrophysiology Source Summary & 10-20 Topology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EEGSourceSummaryCard
          sourceKind="SYNTHETIC"
          mode="SIMULATION"
          channels={["C3", "Cz", "C4"]}
          sampleRateHz={250}
          connectionState={connectionState}
        />

        <EEGChannelTopology
          selectedChannel={selectedChannel}
          onSelectChannel={(ch) => setSelectedChannel(ch)}
        />
      </div>

      {/* Level 2: Realtime Multi-Channel Waveform Oscilloscope */}
      <EEGOscilloscope
        channels={["C3", "Cz", "C4"]}
        selectedChannel={selectedChannel}
        sampleRateHz={250}
        activeIntent={simStatus.current_intent}
        activeCue={simStatus.current_cue}
        signalQuality={latestSnapshot?.signal_quality || null}
        isRunning={simStatus.is_running && !simStatus.is_paused}
        ringBuffer={ringBufferRef.current}
        packetRate={packetRate}
        latencyMs={latencyMs}
      />

      {/* Level 2 Sub-panel: Electrode Signal Quality & Continuity Matrix */}
      <SignalQualityPanel
        metrics={latestSnapshot?.signal_quality || null}
        isConnected={isConnected}
        activeFaults={simStatus.active_faults}
      />

      {/* Level 3: Frequency Domain Analysis (PSD) & Band Power Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PSDChart
          psdData={psdData}
          selectedChannel={selectedChannel}
          onMethodChange={(method) => runSpectralAnalyses(method, selectedChannel)}
          onRefresh={() => runSpectralAnalyses("welch", selectedChannel)}
          onExport={handleExportPsd}
          isLoading={isComputingAnalysis}
        />

        <BandPowerComparison
          bandData={bandData}
          onExport={handleExportBandPower}
        />
      </div>

      {/* Level 4: Time-Frequency Morlet Wavelet Spectrogram & DSP Preprocessing Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeFrequencyHeatmap
          tfrData={tfrData}
          selectedChannel={selectedChannel === "ALL" ? "C3" : selectedChannel}
          onChannelChange={(ch) => runSpectralAnalyses("welch", ch)}
          onCompute={(ch) => runSpectralAnalyses("welch", ch)}
          onExportJson={handleExportAnalysisJson}
          isLoading={isComputingAnalysis}
        />

        <PreprocessingOverview />
      </div>

      {/* Scientific Analysis Provenance & Reproducibility Footer */}
      <AnalysisProvenanceFooter
        version="EEG_ANALYSIS_V1"
        sessionId="ses_sim_001"
        trialId="trl_001"
        mode="SIMULATION"
        engine="MNE-Python 1.12.1"
      />
    </div>
  );
}
