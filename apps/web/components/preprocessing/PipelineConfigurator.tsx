"use client";

import React from "react";
import {
  PreprocessingConfig,
  PreprocessingPreview,
  ReferenceType,
} from "@neuromove/contracts";
import { SectionCard } from "@/components/ui/SectionCard";
import { Sliders, AlertTriangle } from "lucide-react";

interface PipelineConfiguratorProps {
  config: PreprocessingConfig;
  preview: PreprocessingPreview | null;
  onChange: (updated: PreprocessingConfig) => void;
  disabled?: boolean;
}

export function PipelineConfigurator({
  config,
  preview,
  onChange,
  disabled = false,
}: PipelineConfiguratorProps) {
  const updateConfig = (partial: Partial<PreprocessingConfig>) => {
    onChange({ ...config, ...partial });
  };

  const applyPreset = (presetName: string) => {
    if (presetName === "standard-mi") {
      onChange({
        ...config,
        highpass_hz: 0.5,
        lowpass_hz: 40.0,
        reference_type: "average",
        notch: { enabled: false, frequencies_hz: [50.0], notch_width_hz: 2.0 },
        resample: { enabled: false, target_hz: null, anti_aliasing: true },
        artifact_method: "NONE",
      });
    } else if (presetName === "sensorimotor-mubeta") {
      onChange({
        ...config,
        highpass_hz: 8.0,
        lowpass_hz: 30.0,
        reference_type: "average",
        notch: { enabled: false, frequencies_hz: [50.0], notch_width_hz: 2.0 },
        resample: { enabled: false, target_hz: null, anti_aliasing: true },
        artifact_method: "NONE",
      });
    } else if (presetName === "notch-50hz") {
      onChange({
        ...config,
        highpass_hz: 0.5,
        lowpass_hz: 60.0,
        reference_type: "average",
        notch: { enabled: true, frequencies_hz: [50.0], notch_width_hz: 2.0 },
        resample: { enabled: false, target_hz: null, anti_aliasing: true },
        artifact_method: "NONE",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Presets Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            DSP Configuration Presets:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyPreset("standard-mi")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Motor Imagery Default (0.5–40 Hz)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyPreset("sensorimotor-mubeta")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Mu/Beta Band (8–30 Hz)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyPreset("notch-50hz")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Line-Noise Suppression (50 Hz)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Band-Pass Filter Card */}
        <SectionCard
          title="Zero-Phase Band-Pass Filter"
          description="FIR bandpass filtering using Hamming-windowed sinc (firwin design)."
          badge={{ label: `${config.highpass_hz} – ${config.lowpass_hz} Hz`, variant: "brand" }}
        >
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>High-Pass Cutoff (Baseline Drift):</span>
                <span className="font-mono text-blue-600">{config.highpass_hz} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                disabled={disabled}
                value={config.highpass_hz}
                onChange={(e) => updateConfig({ highpass_hz: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Low-Pass Cutoff (High Frequency):</span>
                <span className="font-mono text-blue-600">{config.lowpass_hz} Hz</span>
              </div>
              <input
                type="range"
                min="10.0"
                max="60.0"
                step="1.0"
                disabled={disabled}
                value={config.lowpass_hz}
                onChange={(e) => updateConfig({ lowpass_hz: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </SectionCard>

        {/* Reference Stage Card */}
        <SectionCard
          title="Spatial Reference Transformation"
          description="Montage re-referencing to eliminate common mode noise."
          badge={{ label: config.reference_type.toUpperCase(), variant: "neutral" }}
        >
          <div className="space-y-3 pt-2">
            <label className="text-xs font-medium text-slate-700">Referencing Method:</label>
            <div className="grid grid-cols-3 gap-2">
              {(["average", "none", "channel"] as ReferenceType[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateConfig({ reference_type: mode })}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    config.reference_type === mode
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {mode === "average" ? "Common Avg" : mode === "none" ? "Raw / None" : "Cz Channel"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              {config.reference_type === "average"
                ? "Subtracts instantaneous average of all active scalp channels."
                : config.reference_type === "channel"
                ? "Re-references all EEG channels against vertex electrode (Cz)."
                : "Retains original hardware acquisition montage reference."}
            </p>
          </div>
        </SectionCard>

        {/* Line-Noise Notch Card */}
        <SectionCard
          title="Line-Noise Notch Filter"
          description="Narrowband zero-phase attenuation for power line hum."
          badge={{
            label: config.notch.enabled ? `${config.notch.frequencies_hz.join(",")} Hz ON` : "OFF",
            variant: config.notch.enabled ? "brand" : "neutral",
          }}
        >
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Enable Notch Filtering:</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  updateConfig({
                    notch: { ...config.notch, enabled: !config.notch.enabled },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.notch.enabled ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.notch.enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {config.notch.enabled && (
              <div className="flex gap-2">
                {[50.0, 60.0].map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      updateConfig({
                        notch: { ...config.notch, frequencies_hz: [freq] },
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      config.notch.frequencies_hz.includes(freq)
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {freq} Hz (Grid)
                  </button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Resampling Card */}
        <SectionCard
          title="Temporal Resampling Stage"
          description="Polyphase anti-aliased resampling for cross-hardware normalization."
          badge={{
            label: config.resample.enabled && config.resample.target_hz
              ? `${config.resample.target_hz} Hz`
              : "OFF (Native)",
            variant: config.resample.enabled ? "brand" : "neutral",
          }}
        >
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Enable Resampling:</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  updateConfig({
                    resample: {
                      ...config.resample,
                      enabled: !config.resample.enabled,
                      target_hz: !config.resample.enabled ? 128 : null,
                    },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.resample.enabled ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.resample.enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {config.resample.enabled && (
              <div className="flex gap-2">
                {[128, 160, 200, 250].map((hz) => (
                  <button
                    key={hz}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      updateConfig({
                        resample: { ...config.resample, target_hz: hz },
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      config.resample.target_hz === hz
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {hz} Hz
                  </button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Preview Warnings & Validation Alert */}
      {preview && preview.warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>DSP Pipeline Warnings</span>
          </div>
          <ul className="text-xs text-amber-700 space-y-1 list-disc pl-5">
            {preview.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
