"use client";

import React, { useState } from "react";
import { ConfidenceConfig } from "@neuromove/contracts";
import { Sliders, Save, RotateCcw, ShieldCheck, Check } from "lucide-react";

interface ConfidenceConfigEditorProps {
  config: ConfidenceConfig;
  onSave: (updated: Partial<ConfidenceConfig>) => Promise<void>;
  isSaving?: boolean;
}

export function ConfidenceConfigEditor({
  config,
  onSave,
  isSaving = false,
}: ConfidenceConfigEditorProps) {
  const [form, setForm] = useState<ConfidenceConfig>(config);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = (field: keyof ConfidenceConfig, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
  };

  const handleResetDefaults = () => {
    setForm({
      ...config,
      high_threshold: 0.75,
      medium_threshold: 0.55,
      min_eligible_confidence: 0.40,
      min_consecutive_windows: 3,
      min_duration_ms: 500.0,
      max_gap_ms: 500.0,
      cooldown_ms: 1000.0,
      refractory_ms: 500.0,
      hysteresis_enter: 0.75,
      hysteresis_exit: 0.60,
      max_age_ms: 400.0,
      quality_floor: 0.50,
      allow_same_class_reconfirmation: false,
    });
    setSavedSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Confidence & Temporal Policy Configuration</h3>
            <p className="text-xs text-slate-500">Version: {form.version} | Checksum: {form.checksum ? form.checksum.slice(0, 16) : "auto"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {savedSuccess ? "Saved!" : isSaving ? "Saving..." : "Save Policy"}
          </button>
        </div>
      </div>

      {/* Grid Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
        {/* Confidence Thresholds */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Confidence Bands
          </h4>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>High Threshold (&ge;)</span>
              <span className="font-bold text-slate-900">{(form.high_threshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={form.high_threshold}
              onChange={(e) => handleChange("high_threshold", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Medium Threshold (&ge;)</span>
              <span className="font-bold text-slate-900">{(form.medium_threshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.80"
              step="0.05"
              value={form.medium_threshold}
              onChange={(e) => handleChange("medium_threshold", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Min Eligible Floor (&ge;)</span>
              <span className="font-bold text-slate-900">{(form.min_eligible_confidence * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.60"
              step="0.05"
              value={form.min_eligible_confidence}
              onChange={(e) => handleChange("min_eligible_confidence", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        {/* Temporal Confirmation Settings */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-teal-600" /> Evidence Continuity
          </h4>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Min Consecutive Windows</span>
              <span className="font-bold text-slate-900">{form.min_consecutive_windows} epochs</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={form.min_consecutive_windows}
              onChange={(e) => handleChange("min_consecutive_windows", parseInt(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Min Sustained Duration</span>
              <span className="font-bold text-slate-900">{form.min_duration_ms} ms</span>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="50"
              value={form.min_duration_ms}
              onChange={(e) => handleChange("min_duration_ms", parseFloat(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Cooldown Period</span>
              <span className="font-bold text-slate-900">{form.cooldown_ms} ms</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={form.cooldown_ms}
              onChange={(e) => handleChange("cooldown_ms", parseFloat(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>
        </div>

        {/* Hysteresis & Gating Policies */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Hysteresis & Gating
          </h4>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Hysteresis Enter Threshold</span>
              <span className="font-bold text-slate-900">{(form.hysteresis_enter * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.60"
              max="0.90"
              step="0.05"
              value={form.hysteresis_enter}
              onChange={(e) => handleChange("hysteresis_enter", parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Hysteresis Exit Floor</span>
              <span className="font-bold text-slate-900">{(form.hysteresis_exit * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.75"
              step="0.05"
              value={form.hysteresis_exit}
              onChange={(e) => handleChange("hysteresis_exit", parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Signal Quality Floor</span>
              <span className="font-bold text-slate-900">{(form.quality_floor * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={form.quality_floor}
              onChange={(e) => handleChange("quality_floor", parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
