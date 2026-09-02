"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Save, CheckCircle2, Shield, Hash, RefreshCw } from "lucide-react";
import { SafetyPolicy } from "@neuromove/contracts";

interface SafetyPolicyEditorProps {
  policy: SafetyPolicy | null;
  onSavePolicy: (policy: SafetyPolicy) => Promise<void>;
  loading?: boolean;
}

export const SafetyPolicyEditor: React.FC<SafetyPolicyEditorProps> = ({
  policy,
  onSavePolicy,
  loading = false,
}) => {
  const [formData, setFormData] = useState<SafetyPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (policy) {
      setFormData({ ...policy });
    }
  }, [policy]);

  if (!formData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        Loading safety policy specification...
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    try {
      setSaving(true);
      await onSavePolicy(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Safety Policy Parameters</h3>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              v{formData.version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic software parameters and cryptographic SHA-256 verification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span>Checksum: {formData.checksum || "Unsaved"}</span>
          </div>

          <button
            type="submit"
            disabled={loading || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Policy"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
        {/* Intent Allowlist / Blocklist */}
        <div className="space-y-3 p-4 bg-slate-50/70 rounded-lg border border-slate-100">
          <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-600" /> Intent Classes
          </h4>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Allowlisted Intents (comma-separated)
            </label>
            <input
              type="text"
              value={formData.allowlisted_intents.join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allowlisted_intents: e.target.value
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean),
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Blocked Intents (comma-separated)
            </label>
            <input
              type="text"
              value={formData.blocked_intents.join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  blocked_intents: e.target.value
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean),
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Temporal Limits */}
        <div className="space-y-3 p-4 bg-slate-50/70 rounded-lg border border-slate-100">
          <h4 className="font-bold text-slate-800">Timing & Freshness Constraints</h4>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Max Intent Age (ms)
            </label>
            <input
              type="number"
              value={formData.max_intent_age_ms}
              onChange={(e) =>
                setFormData({ ...formData, max_intent_age_ms: parseFloat(e.target.value) || 500 })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Max Context Age (ms)
            </label>
            <input
              type="number"
              value={formData.max_context_age_ms}
              onChange={(e) =>
                setFormData({ ...formData, max_context_age_ms: parseFloat(e.target.value) || 1000 })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Max Continuous Duration (ms)
            </label>
            <input
              type="number"
              value={formData.max_authorized_duration_ms}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_authorized_duration_ms: parseFloat(e.target.value) || 2000,
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Rate Limiting & Lockout */}
        <div className="space-y-3 p-4 bg-slate-50/70 rounded-lg border border-slate-100">
          <h4 className="font-bold text-slate-800">Execution Rate & Lockout Policy</h4>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Max Commands per Window
            </label>
            <input
              type="number"
              value={formData.maximum_command_rate}
              onChange={(e) =>
                setFormData({ ...formData, maximum_command_rate: parseInt(e.target.value, 10) || 5 })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Minimum Command Gap (ms)
            </label>
            <input
              type="number"
              value={formData.minimum_command_gap_ms}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  minimum_command_gap_ms: parseFloat(e.target.value) || 100,
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Consecutive Denial Lockout Threshold
            </label>
            <input
              type="number"
              value={formData.lockout_threshold}
              onChange={(e) =>
                setFormData({ ...formData, lockout_threshold: parseInt(e.target.value, 10) || 3 })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
