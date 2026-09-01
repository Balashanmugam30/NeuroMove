"use client";

import React, { useState, useEffect } from "react";
import {
  PreprocessingConfig,
  PreprocessingPreview,
  PreprocessingRequest,
  PreprocessingResult,
  PreprocessingSignalResponse,
  PreprocessingManifest,
  EEGSourceKind,
} from "@neuromove/contracts";
import {
  previewPreprocessingPipeline,
  runPreprocessingPipeline,
  fetchPreprocessingSignal,
  fetchPreprocessingManifest,
} from "@/lib/api-client";
import { PipelineConfigurator } from "@/components/preprocessing/PipelineConfigurator";
import { SignalComparisonPanel } from "@/components/preprocessing/SignalComparisonPanel";
import { StageAuditCard } from "@/components/preprocessing/StageAuditCard";
import {
  Cpu,
  Play,
  RotateCw,
} from "lucide-react";


const FALLBACK_DEFAULT_CONFIG: PreprocessingConfig = {
  pipeline_version: "EEG_PREPROCESSING_V1",
  reference_type: "average",
  reference_channels: [],
  highpass_hz: 0.5,
  lowpass_hz: 40.0,
  notch: { enabled: false, frequencies_hz: [50.0], notch_width_hz: 2.0 },
  resample: { enabled: false, target_hz: null, anti_aliasing: true },
  bad_channels: [],
  artifact_method: "NONE",
  ica_config: {
    enabled: false,
    n_components: 15,
    method: "fastica",
    random_state: 42,
    fit_channels: [],
    excluded_components: [],
  },
};

const FALLBACK_RESULT: PreprocessingResult = {
  result_id: "pre_5c162ad331ee_default",
  pipeline_version: "EEG_PREPROCESSING_V1",
  config_hash: "5c162ad331ee6af3",
  source_kind: "SYNTHETIC",
  input_sample_rate_hz: 250.0,
  output_sample_rate_hz: 250.0,
  input_channels: ["Fc5", "C3", "Cz", "C4"],
  output_channels: ["Fc5", "C3", "Cz", "C4"],
  duration_seconds: 10.0,
  event_count: 3,
  artifact_file_path: "data/processed/pre_5c162ad331ee_default_raw.fif",
  artifact_checksum_sha256: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
  integrity_report: {
    sample_count: 2500,
    channel_count: 4,
    nan_count: 0,
    inf_count: 0,
    min_amplitude_uv: -42.5,
    max_amplitude_uv: 38.2,
    flatline_channels: [],
    amplitude_outlier_candidates: 0,
    status: "HEALTHY",
  },
  stage_audit: [
    {
      stage: "VALIDATE",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 1.2,
      parameters: { channels: 4, sampling_rate: 250.0 },
      warnings: [],
    },
    {
      stage: "REFERENCE",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 2.4,
      parameters: { reference: "average" },
      warnings: [],
    },
    {
      stage: "FILTER",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 8.5,
      parameters: { highpass_hz: 0.5, lowpass_hz: 40.0, method: "fir" },
      warnings: [],
    },
    {
      stage: "NOTCH",
      status: "SKIPPED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 0.1,
      parameters: { reason: "disabled" },
      warnings: [],
    },
    {
      stage: "RESAMPLE",
      status: "SKIPPED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 0.1,
      parameters: { reason: "disabled" },
      warnings: [],
    },
    {
      stage: "ARTIFACT",
      status: "SKIPPED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 0.1,
      parameters: { method: "NONE" },
      warnings: [],
    },
    {
      stage: "FINAL_VALIDATE",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 1.5,
      parameters: { status: "HEALTHY" },
      warnings: [],
    },
  ],
  warnings: [],
  software_versions: { mne: "1.12.1", numpy: "2.5.2", scipy: "1.18.1" },
  created_at: "2026-09-01T00:00:00Z",
};

const FALLBACK_RAW_SIGNAL: PreprocessingSignalResponse = {
  result_id: "raw_mock",
  sampling_rate_hz: 250.0,
  channels: ["Fc5", "C3", "Cz", "C4"],
  timestamps: Array.from({ length: 500 }, (_, i) => i / 250.0),
  signals: {
    C3: Array.from({ length: 500 }, (_, i) => 15 * Math.sin(2 * Math.PI * 12 * (i / 250)) + 12 * Math.sin(2 * Math.PI * 0.3 * (i / 250))),
    Cz: Array.from({ length: 500 }, (_, i) => 25 * Math.sin(2 * Math.PI * 0.3 * (i / 250)) + 5 * Math.sin(2 * Math.PI * 10 * (i / 250))),
    C4: Array.from({ length: 500 }, (_, i) => 20 * Math.sin(2 * Math.PI * 12 * (i / 250))),
    Fc5: Array.from({ length: 500 }, (_, i) => 10 * Math.sin(2 * Math.PI * 10 * (i / 250))),
  },
  events: [],
};

const FALLBACK_PROC_SIGNAL: PreprocessingSignalResponse = {
  result_id: "pre_5c162ad331ee_default",
  sampling_rate_hz: 250.0,
  channels: ["Fc5", "C3", "Cz", "C4"],
  timestamps: Array.from({ length: 500 }, (_, i) => i / 250.0),
  signals: {
    C3: Array.from({ length: 500 }, (_, i) => 15 * Math.sin(2 * Math.PI * 12 * (i / 250))),
    Cz: Array.from({ length: 500 }, (_, i) => 5 * Math.sin(2 * Math.PI * 10 * (i / 250))),
    C4: Array.from({ length: 500 }, (_, i) => 20 * Math.sin(2 * Math.PI * 12 * (i / 250))),
    Fc5: Array.from({ length: 500 }, (_, i) => 10 * Math.sin(2 * Math.PI * 10 * (i / 250))),
  },
  events: [],
};

export default function PreprocessingWorkspacePage() {
  const [sourceKind, setSourceKind] = useState<EEGSourceKind>("SYNTHETIC");
  const selectedRecordingId = "rec_eegbci_S001_R04";
  const [config, setConfig] = useState<PreprocessingConfig>(FALLBACK_DEFAULT_CONFIG);
  const [preview, setPreview] = useState<PreprocessingPreview | null>(null);
  const [result, setResult] = useState<PreprocessingResult | null>(FALLBACK_RESULT);
  const [rawSignal] = useState<PreprocessingSignalResponse | null>(FALLBACK_RAW_SIGNAL);
  const [procSignal, setProcSignal] = useState<PreprocessingSignalResponse | null>(FALLBACK_PROC_SIGNAL);
  const [manifest, setManifest] = useState<PreprocessingManifest | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("C3");

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // Load initial preview when config or source changes
  useEffect(() => {
    const updatePreview = async () => {
      try {
        const req: PreprocessingRequest = {
          source_kind: sourceKind,
          recording_id: sourceKind === "RECORDED" ? selectedRecordingId : undefined,
          config,
        };
        const prev = await previewPreprocessingPipeline(req);
        setPreview(prev);
      } catch {
        // Fallback preview
      }
    };
    updatePreview();
  }, [sourceKind, selectedRecordingId, config]);

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setActiveStep("VALIDATING");

    try {
      const req: PreprocessingRequest = {
        source_kind: sourceKind,
        recording_id: sourceKind === "RECORDED" ? selectedRecordingId : undefined,
        config,
      };

      // Simulated step transitions for visual feedback
      setTimeout(() => setActiveStep("FILTERING"), 200);
      setTimeout(() => setActiveStep("FINAL_VALIDATE"), 400);

      const res = await runPreprocessingPipeline(req);
      setResult(res);

      const [procSig, man] = await Promise.all([
        fetchPreprocessingSignal(res.result_id, ["Fc5", "C3", "Cz", "C4"], 0.0, 2.0).catch(() => FALLBACK_PROC_SIGNAL),
        fetchPreprocessingManifest(res.result_id).catch(() => null),
      ]);
      setProcSignal(procSig);
      setManifest(man);
    } catch {
      // Retain fallback result on offline error
    } finally {
      setIsRunning(false);
      setActiveStep(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              BCI PREPROCESSING
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              EEG_PREPROCESSING_V1
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            EEG Preprocessing & DSP Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Configurable, zero-phase filtering, spatial re-referencing, line-noise notch, and
            reproducible artifact conditioning workspace.
          </p>
        </div>

        {/* Source Selection Toggle */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setSourceKind("SYNTHETIC")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sourceKind === "SYNTHETIC"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Synthetic Sim (250 Hz)
          </button>
          <button
            type="button"
            onClick={() => setSourceKind("RECORDED")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sourceKind === "RECORDED"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            PhysioNet EEGBCI (160 Hz)
          </button>
        </div>
      </div>

      {/* 2. Pipeline Execution Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 tracking-wide">
              {sourceKind === "SYNTHETIC" ? "SYNTHETIC SIMULATION SOURCE" : "RECORDED PUBLIC DATASET SOURCE"}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Input: {sourceKind === "SYNTHETIC" ? "250 Hz · 4 ch" : "160 Hz · 64 ch"} → Target:{" "}
              {config.highpass_hz}–{config.lowpass_hz} Hz · Ref: {config.reference_type}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={handleRunPipeline}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Running {activeStep}...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Preprocessing Pipeline</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Pipeline Configurator */}
      <PipelineConfigurator
        config={config}
        preview={preview}
        onChange={setConfig}
        disabled={isRunning}
      />

      {/* 4. RAW vs PROCESSED Dual Comparison View */}
      {result && (
        <SignalComparisonPanel
          result={result}
          rawSignal={rawSignal}
          procSignal={procSignal}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
        />
      )}

      {/* 5. Stage Audit Trail & Export Manifest */}
      {result && (
        <StageAuditCard
          audits={result.stage_audit}
          manifest={manifest}
          pipelineVersion={result.pipeline_version}
        />
      )}
    </div>
  );
}
