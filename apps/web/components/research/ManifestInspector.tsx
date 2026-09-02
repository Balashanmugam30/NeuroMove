"use client";

import React, { useState } from "react";
import { ResearchExperiment } from "@neuromove/contracts";
import { Shield, Lock, FileCode, Copy, Check } from "lucide-react";

interface ManifestInspectorProps {
  experiment: ResearchExperiment;
  onSeal?: () => void;
  isSealing?: boolean;
}

export function ManifestInspector({
  experiment,
  onSeal,
  isSealing = false,
}: ManifestInspectorProps) {
  const [copied, setCopied] = useState(false);
  const manifest = experiment.manifest;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(manifest.manifest_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Immutable Manifest & Provenance
              {manifest.is_sealed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  <Lock className="w-3 h-3" /> Sealed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Draft
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Canonical JSON SHA-256 fingerprint guarantees byte-for-byte evaluation reproducibility
            </p>
          </div>
        </div>

        {!manifest.is_sealed && onSeal && (
          <button
            type="button"
            onClick={onSeal}
            disabled={isSealing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5" />
            {isSealing ? "Sealing..." : "Seal Manifest"}
          </button>
        )}
      </div>

      {/* SHA-256 Hash Display */}
      <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="text-3xs uppercase tracking-wider font-semibold text-slate-400">
            SHA-256 Manifest Hash
          </span>
          <div className="font-mono text-xs text-indigo-300 truncate">
            {manifest.manifest_hash}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyHash}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          title="Copy Hash"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid of Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
          <div className="text-slate-400 text-3xs uppercase">Sampling Rate</div>
          <div className="font-mono text-white font-medium mt-0.5">{manifest.sampling_rate} Hz</div>
        </div>
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
          <div className="text-slate-400 text-3xs uppercase">Channels ({manifest.channel_names.length})</div>
          <div className="font-mono text-white font-medium mt-0.5 truncate" title={manifest.channel_names.join(", ")}>
            {manifest.channel_names.join(", ")}
          </div>
        </div>
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
          <div className="text-slate-400 text-3xs uppercase">Model & Version</div>
          <div className="font-mono text-white font-medium mt-0.5 truncate">
            {manifest.model_id} ({manifest.model_version})
          </div>
        </div>
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
          <div className="text-slate-400 text-3xs uppercase">Deterministic Seed</div>
          <div className="font-mono text-white font-medium mt-0.5">{manifest.seed}</div>
        </div>
      </div>

      {/* Parent lineage or non-actuation note */}
      {experiment.parent_experiment_id ? (
        <div className="bg-indigo-950/30 border border-indigo-500/20 p-2.5 rounded-lg flex items-center gap-2 text-xs text-indigo-300">
          <span className="font-semibold">Child Lineage:</span> Derived from parent{" "}
          <code className="font-mono bg-indigo-900/50 px-1 py-0.5 rounded text-indigo-200">
            {experiment.parent_experiment_id}
          </code>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-lg flex items-center gap-2 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Strict non-actuation policy enforced. Offline replay dispatches to ESP32 HIL virtual emulator.</span>
        </div>
      )}
    </div>
  );
}
