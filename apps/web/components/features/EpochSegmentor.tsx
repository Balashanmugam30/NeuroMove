"use client";

import React, { useState } from "react";
import {
  EpochingPreview,
  EpochingRequest,
} from "@neuromove/contracts";

interface EpochSegmentorProps {
  onRunEpoching: (req: EpochingRequest) => Promise<void>;
  onPreviewEpoching: (req: EpochingRequest) => Promise<EpochingPreview | null>;
  isLoading: boolean;
}

export function EpochSegmentor({
  onRunEpoching,
  onPreviewEpoching,
  isLoading,
}: EpochSegmentorProps) {
  const [sourceKind, setSourceKind] = useState<"SYNTHETIC" | "RECORDED">("SYNTHETIC");
  const [scenarioId, setScenarioId] = useState("right-turn");
  const [recordingId, setRecordingId] = useState("rec_eegbci_S001_R04");
  const [tmin, setTmin] = useState(-1.0);
  const [tmax, setTmax] = useState(4.0);
  const [baselineStart, setBaselineStart] = useState(-1.0);
  const [baselineEnd, setBaselineEnd] = useState(0.0);
  const [baselineMode, setBaselineMode] = useState<"APPLIED" | "NOT_APPLIED">("APPLIED");
  const [analysisStart, setAnalysisStart] = useState(0.5);
  const [analysisEnd, setAnalysisEnd] = useState(4.0);
  const [ampReject, setAmpReject] = useState<number | "">(100.0);
  const [preview, setPreview] = useState<EpochingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const getRequestPayload = (): EpochingRequest => ({
    source_kind: sourceKind,
    dataset_id: sourceKind === "RECORDED" ? "eegbci" : "simulation",
    recording_id: sourceKind === "RECORDED" ? recordingId : undefined,
    scenario_id: sourceKind === "SYNTHETIC" ? scenarioId : undefined,
    epoch_config: {
      epoching_version: "EEG_EPOCHING_V1",
      tmin,
      tmax,
      baseline: baselineMode === "APPLIED" ? [baselineStart, baselineEnd] : null,
      baseline_mode: baselineMode,
      analysis_window: [analysisStart, analysisEnd],
      reject_by_annotation: true,
      amplitude_rejection_uv: ampReject === "" ? null : Number(ampReject),
    },
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await onPreviewEpoching(getRequestPayload());
      setPreview(res);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRun = async () => {
    await onRunEpoching(getRequestPayload());
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Motor-Imagery Epoch Segmentation
          </h2>
          <p className="text-sm text-slate-500">
            Define trial windows, baseline correction, and quality control thresholds
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          EEG_EPOCHING_V1
        </span>
      </div>

      {/* Source Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
            Data Source
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSourceKind("SYNTHETIC")}
              className={`px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                sourceKind === "SYNTHETIC"
                  ? "bg-blue-50 border-blue-400 text-blue-700 shadow-2xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Synthetic Simulation
            </button>
            <button
              type="button"
              onClick={() => setSourceKind("RECORDED")}
              className={`px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                sourceKind === "RECORDED"
                  ? "bg-blue-50 border-blue-400 text-blue-700 shadow-2xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              PhysioNet Recorded
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
            {sourceKind === "SYNTHETIC" ? "Simulation Scenario" : "PhysioNet Recording ID"}
          </label>
          {sourceKind === "SYNTHETIC" ? (
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-sans focus:ring-1 focus:ring-blue-500"
            >
              <option value="right-turn">Right Turn (Left vs Right MI)</option>
              <option value="hallway-patrol">Hallway Patrol (Continuous)</option>
              <option value="doorway-approach">Doorway Approach (Safety Cues)</option>
            </select>
          ) : (
            <input
              type="text"
              value={recordingId}
              onChange={(e) => setRecordingId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Epoch Window & Timing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Epoch Interval (s) [tmin, tmax]
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              step="0.5"
              value={tmin}
              onChange={(e) => setTmin(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="number"
              step="0.5"
              value={tmax}
              onChange={(e) => setTmax(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Baseline Window (s)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              step="0.5"
              value={baselineStart}
              onChange={(e) => setBaselineStart(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="number"
              step="0.5"
              value={baselineEnd}
              onChange={(e) => setBaselineEnd(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Analysis Window (s) [Feature Slicing]
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              step="0.5"
              value={analysisStart}
              onChange={(e) => setAnalysisStart(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="number"
              step="0.5"
              value={analysisEnd}
              onChange={(e) => setAnalysisEnd(parseFloat(e.target.value))}
              className="w-1/2 px-2 py-1 text-sm bg-white border border-slate-300 rounded text-slate-900 font-mono"
            />
          </div>
        </div>
      </div>

      {/* QC & Baseline Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Baseline Mode
          </label>
          <select
            value={baselineMode}
            onChange={(e) => setBaselineMode(e.target.value as "APPLIED" | "NOT_APPLIED")}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-sans"
          >
            <option value="APPLIED">Applied (Subtract Mean Baseline)</option>
            <option value="NOT_APPLIED">None (Raw Signal Amplitude)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Peak Amplitude Rejection Threshold (uV)
          </label>
          <input
            type="number"
            value={ampReject}
            placeholder="e.g. 100 (leave empty to disable)"
            onChange={(e) => setAmpReject(e.target.value === "" ? "" : parseFloat(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
          />
        </div>
      </div>

      {/* Preview Output */}
      {preview && (
        <div
          className={`p-4 rounded-lg border text-sm ${
            preview.valid
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="font-bold mb-1">
            {preview.valid ? "Configuration Valid" : "Configuration Issues"}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div>Discovered Events: {preview.events_discovered}</div>
            <div>Mapped Trials: {preview.mapped_events}</div>
            <div>Expected Epochs: {preview.expected_epochs}</div>
            <div>Labels: {preview.labels_found.join(", ") || "None"}</div>
          </div>
          {preview.warnings.length > 0 && (
            <ul className="mt-2 text-xs list-disc list-inside text-amber-700">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {preview.errors.length > 0 && (
            <ul className="mt-2 text-xs list-disc list-inside text-rose-700 font-semibold">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewLoading || isLoading}
          className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs"
        >
          {previewLoading ? "Validating..." : "Preview Segmentation"}
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={isLoading || previewLoading}
          className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs disabled:opacity-50 transition"
        >
          {isLoading ? "Extracting Epochs..." : "Run Epoch Segmentation"}
        </button>
      </div>
    </div>
  );
}
