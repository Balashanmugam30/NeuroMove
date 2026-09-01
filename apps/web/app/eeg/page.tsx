"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  fetchDatasetSignal,
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
import { Button } from "@/components/ui/Button";
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  Database,
  Radio,
} from "lucide-react";

function EEGLabContent() {
  const searchParams = useSearchParams();
  const queryMode = searchParams.get("mode");
  const queryRecording = searchParams.get("recording");
  const queryDataset = searchParams.get("dataset") || "physionet-eegbci";

  const { connectionState, latencyMs, latestSnapshot } = useRealtime();

  // Source selection: SYNTHETIC (SIMULATION) vs RECORDED (REPLAY)
  const [sourceMode, setSourceMode] = useState<"SIMULATION" | "REPLAY">(
    queryMode === "REPLAY" || queryRecording ? "REPLAY" : "SIMULATION"
  );
  const [activeRecordingId, setActiveRecordingId] = useState<string>(
    queryRecording || "rec_eegbci_S001_R04"
  );

  // Replay playback states
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(true);
  const [replayTimeSec, setReplayTimeSec] = useState<number>(4.0);
  const [replaySpeed, setReplaySpeed] = useState<number>(1.0);

  // Ring buffer for oscilloscope
  const ringBufferRef = useRef<EEGRingBuffer>(new EEGRingBuffer(1000, ["C3", "Cz", "C4"]));

  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [packetCount, setPacketCount] = useState<number>(0);
  const [packetRate, setPacketRate] = useState<number>(25);
  const lastPacketCountRef = useRef<number>(0);

  // Simulation status
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

  // Ingest high-frequency synthetic EEG transport packets when in SIMULATION mode
  useRealtimeStream("eeg", (msg) => {
    if (sourceMode === "SIMULATION" && msg.payload && msg.payload.channels) {
      ringBufferRef.current.pushChunk(msg.payload.channels);
      setPacketCount((c) => c + 1);
    }
  });

  // Absorb snapshot
  useEffect(() => {
    if (latestSnapshot?.simulation_status && sourceMode === "SIMULATION") {
      setSimStatus((prev) => ({
        ...prev,
        ...latestSnapshot.simulation_status,
      }));
    }
  }, [latestSnapshot, sourceMode]);

  // Compute transport packet delivery rate per second
  useEffect(() => {
    const rateInterval = setInterval(() => {
      const diff = packetCount - lastPacketCountRef.current;
      lastPacketCountRef.current = packetCount;
      if (diff > 0) setPacketRate(diff);
    }, 1000);

    return () => clearInterval(rateInterval);
  }, [packetCount]);

  // Load recorded signal when in REPLAY mode
  useEffect(() => {
    if (sourceMode === "REPLAY") {
      const loadRecording = async () => {
        try {
          // Fetch signal snippet around current replay time
          const sig = await fetchDatasetSignal(
            queryDataset,
            activeRecordingId,
            ["C3", "Cz", "C4"],
            Math.max(0, replayTimeSec - 4.0),
            4.0
          );
          if (sig && sig.signals) {
            // Push recorded snippet into ring buffer
            const chunk: Record<string, number[]> = {
              C3: sig.signals.C3 || [],
              Cz: sig.signals.Cz || [],
              C4: sig.signals.C4 || [],
            };
            ringBufferRef.current.pushChunk(chunk);
          }
        } catch (e) {
          console.error("Failed to load recording signal:", e);
        }
      };
      loadRecording();
    }
  }, [sourceMode, activeRecordingId, queryDataset, replayTimeSec]);

  // Replay timer loop
  useEffect(() => {
    if (sourceMode !== "REPLAY" || !isReplayPlaying) return;

    const interval = setInterval(() => {
      setReplayTimeSec((prev) => {
        const next = prev + 0.2 * replaySpeed;
        return next > 125.0 ? 0.0 : next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [sourceMode, isReplayPlaying, replaySpeed]);

  // Run spectral analyses (Welch, Multitaper, Band power, TFR)
  const runSpectralAnalyses = async (
    method: PSDMethod = "welch",
    targetChannel: string = "C3"
  ) => {
    setIsComputingAnalysis(true);
    try {
      const isReplay = sourceMode === "REPLAY";
      const [psd, bp, tfr] = await Promise.all([
        fetchPSD({
          dataset_id: isReplay ? queryDataset : undefined,
          recording_id: isReplay ? activeRecordingId : undefined,
          channels: ["C3", "Cz", "C4"],
          method,
          fmin: 1.0,
          fmax: isReplay ? 40.0 : 40.0,
          window_duration_seconds: 4.0,
        }),
        fetchBandPower({
          dataset_id: isReplay ? queryDataset : undefined,
          recording_id: isReplay ? activeRecordingId : undefined,
          channels: ["C3", "Cz", "C4"],
          method,
          window_duration_seconds: 4.0,
        }),
        fetchTFR({
          dataset_id: isReplay ? queryDataset : undefined,
          recording_id: isReplay ? activeRecordingId : undefined,
          channel: targetChannel === "ALL" ? "C3" : targetChannel,
          fmin: 4.0,
          fmax: isReplay ? 35.0 : 35.0,
          window_duration_seconds: 4.0,
        }),
      ]);

      setPsdData(psd);
      setBandData(bp);
      setTfrData(tfr);
    } catch {
      // Offline fallback
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
  }, [sourceMode, activeRecordingId]);

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
  const isRecorded = sourceMode === "REPLAY";

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <PageHeader
        category="BCI Electrophysiology"
        title="EEG Laboratory"
        description="Scientific waveform inspection, spectral analysis, and multi-source research workspace."
        mode={sourceMode}
        actions={
          <div className="flex items-center gap-2">
            {/* Source Mode Toggle */}
            <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-1 text-2xs font-semibold">
              <button
                type="button"
                onClick={() => setSourceMode("SIMULATION")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  sourceMode === "SIMULATION"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Synthetic Sim (250 Hz)</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("REPLAY")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  sourceMode === "REPLAY"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Recorded Dataset (160 Hz)</span>
              </button>
            </div>
          </div>
        }
      />

      {/* Global Toolbar: Scenario or Replay Run, Session, Channel Filter & Status */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {isRecorded ? (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                <span>RECORDED RUN:</span>
                <span>{activeRecordingId}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <span>DATASET:</span>
                <span className="font-bold">PhysioNet EEGBCI</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <span>SAMPLING:</span>
                <span className="font-bold text-teal-700">160 Hz (64 ch)</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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

      {/* Lightweight Replay Control Bar when in REPLAY mode */}
      {isRecorded && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 shadow-xs flex flex-wrap items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsReplayPlaying(!isReplayPlaying)}
              icon={isReplayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            >
              {isReplayPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplayTimeSec(0.0)}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            {/* Playback Speed selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-2xs font-mono">
              {[1.0, 2.0, 5.0].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setReplaySpeed(spd)}
                  className={`px-2 py-1 rounded transition-colors ${
                    replaySpeed === spd
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Seek bar */}
          <div className="flex-1 max-w-md flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-500 text-3xs">00:00</span>
            <input
              type="range"
              min="0"
              max="125"
              step="0.5"
              value={replayTimeSec}
              onChange={(e) => setReplayTimeSec(parseFloat(e.target.value))}
              className="flex-1 accent-blue-600 cursor-pointer"
            />
            <span className="font-bold text-blue-700">
              {replayTimeSec.toFixed(1)}s / 125.0s
            </span>
          </div>

          {/* Recording selector */}
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-bold text-slate-500 uppercase">
              Run:
            </span>
            <select
              value={activeRecordingId}
              onChange={(e) => setActiveRecordingId(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rec_eegbci_S001_R04">S001 - R04 (Imagery Fists)</option>
              <option value="rec_eegbci_S001_R03">S001 - R03 (Execution Fists)</option>
              <option value="rec_eegbci_S001_R06">S001 - R06 (Imagery Feet)</option>
              <option value="rec_eegbci_S001_R01">S001 - R01 (Baseline Rest)</option>
            </select>
          </div>
        </div>
      )}

      {/* Level 1: Electrophysiology Source Summary & 10-20 Topology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EEGSourceSummaryCard
          sourceKind={isRecorded ? "RECORDED" : "SYNTHETIC"}
          mode={sourceMode}
          channels={["C3", "Cz", "C4"]}
          sampleRateHz={isRecorded ? 160 : 250}
          connectionState={isRecorded ? "VERIFIED" : connectionState}
          datasetName={isRecorded ? "PhysioNet EEG Motor Movement/Imagery" : undefined}
          recordingId={isRecorded ? activeRecordingId : undefined}
        />

        <EEGChannelTopology
          selectedChannel={selectedChannel}
          onSelectChannel={(ch) => setSelectedChannel(ch)}
        />
      </div>

      {/* Level 2: Multi-Channel Waveform Oscilloscope */}
      <EEGOscilloscope
        channels={["C3", "Cz", "C4"]}
        selectedChannel={selectedChannel}
        sampleRateHz={isRecorded ? 160 : 250}
        activeIntent={isRecorded ? "NONE" : simStatus.current_intent}
        activeCue={isRecorded ? (replayTimeSec > 4.0 ? "LEFT_IMAGERY" : "REST") : simStatus.current_cue}
        signalQuality={latestSnapshot?.signal_quality || null}
        isRunning={isRecorded ? isReplayPlaying : simStatus.is_running && !simStatus.is_paused}
        ringBuffer={ringBufferRef.current}
        packetRate={isRecorded ? 16 : packetRate}
        latencyMs={isRecorded ? 0.4 : latencyMs}
      />

      {/* Level 2 Sub-panel: Electrode Signal Quality & Continuity Matrix */}
      <SignalQualityPanel
        metrics={latestSnapshot?.signal_quality || null}
        isConnected={isConnected || isRecorded}
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
        sessionId={isRecorded ? "ses_eegbci_S001" : "ses_sim_001"}
        trialId={isRecorded ? "R04" : "trl_001"}
        mode={sourceMode}
        engine="MNE-Python 1.12.1"
      />
    </div>
  );
}

export default function EEGLaboratoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading EEG Laboratory Workspace...</div>}>
      <EEGLabContent />
    </Suspense>
  );
}
