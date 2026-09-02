"use client";

import React, { useState } from "react";
import { IntentPolicy } from "@neuromove/contracts";
import { Sliders, Save, RotateCcw, Check, ShieldCheck } from "lucide-react";

interface IntentPolicyEditorProps {
  policy: IntentPolicy;
  onSave: (updated: Partial<IntentPolicy>) => Promise<void>;
  isSaving?: boolean;
}

export function IntentPolicyEditor({
  policy,
  onSave,
  isSaving = false,
}: IntentPolicyEditorProps) {
  const [form, setForm] = useState<IntentPolicy>(policy);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = (field: keyof IntentPolicy, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
  };

  const handleResetDefaults = () => {
    setForm({
      ...policy,
      candidate_timeout_ms: 1000.0,
      confirmation_acceptance_window_ms: 500.0,
      active_intent_timeout_ms: 2000.0,
      allow_replacement: true,
      replacement_requires_confirmation: true,
      same_class_reconfirmation_cooldown_ms: 1000.0,
      cross_class_replacement_policy: "REQUIRE_CONFIRMATION",
      subject_change_policy: "INTERRUPT_AND_RESET",
      session_change_policy: "INTERRUPT_AND_RESET",
      model_change_policy: "INTERRUPT_AND_RESET",
      rest_handling_policy: "CANCEL_CANDIDATE",
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
            <h3 className="text-sm font-semibold text-slate-900">Lifecycle Policy Configuration</h3>
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
        {/* State Timers */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> State Timeout Deadlines
          </h4>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Candidate Timeout</span>
              <span className="font-bold text-slate-900">{form.candidate_timeout_ms} ms</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={form.candidate_timeout_ms}
              onChange={(e) => handleChange("candidate_timeout_ms", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Confirmation Window</span>
              <span className="font-bold text-slate-900">{form.confirmation_acceptance_window_ms} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={form.confirmation_acceptance_window_ms}
              onChange={(e) => handleChange("confirmation_acceptance_window_ms", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Active Intent Max Duration</span>
              <span className="font-bold text-slate-900">{form.active_intent_timeout_ms} ms</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="250"
              value={form.active_intent_timeout_ms}
              onChange={(e) => handleChange("active_intent_timeout_ms", parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        {/* Replacement & Reconfirmation */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-teal-600" /> Replacement & Cooldown
          </h4>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Reconfirmation Cooldown</span>
              <span className="font-bold text-slate-900">{form.same_class_reconfirmation_cooldown_ms} ms</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={form.same_class_reconfirmation_cooldown_ms}
              onChange={(e) => handleChange("same_class_reconfirmation_cooldown_ms", parseFloat(e.target.value))}
              className="w-full accent-teal-600"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-semibold text-slate-800">Allow Replacement</div>
              <div className="text-[11px] text-slate-500">Cross-class intent preemption</div>
            </div>
            <input
              type="checkbox"
              checked={form.allow_replacement}
              onChange={(e) => handleChange("allow_replacement", e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
            />
          </div>

          <div className="pt-2">
            <label className="block text-slate-700 font-semibold mb-1">Cross-Class Policy</label>
            <select
              value={form.cross_class_replacement_policy}
              onChange={(e) => handleChange("cross_class_replacement_policy", e.target.value)}
              className="w-full py-1 px-2 rounded bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="REQUIRE_CONFIRMATION">Require Confirmation</option>
              <option value="IMMEDIATE">Immediate</option>
              <option value="REJECT">Reject</option>
            </select>
          </div>
        </div>

        {/* Boundary & Rest Policies */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Boundaries & Rest Policy
          </h4>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Rest Prediction Action</label>
            <select
              value={form.rest_handling_policy}
              onChange={(e) => handleChange("rest_handling_policy", e.target.value)}
              className="w-full py-1 px-2 rounded bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="CANCEL_CANDIDATE">Cancel Candidate Only</option>
              <option value="INTERRUPT_ACTIVE">Interrupt Active & Cancel Candidate</option>
              <option value="IGNORE">Ignore Rest</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Subject Switch Policy</label>
            <div className="p-2 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[11px]">
              INTERRUPT_AND_RESET
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Session Switch Policy</label>
            <div className="p-2 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[11px]">
              INTERRUPT_AND_RESET
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
