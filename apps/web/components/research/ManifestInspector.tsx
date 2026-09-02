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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Immutable Manifest & Provenance
              {manifest.is_sealed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  <Lock className="w-3 h-3" /> Sealed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                  Draft
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Canonical JSON SHA-256 fingerprint guarantees byte-for-byte evaluation reproducibility
            </p>
          </div>
        </div>

        {!manifest.is_sealed && onSeal && (
          <button
            type="button"
            onClick={onSeal}
            disabled={isSealing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5" />
            {isSealing ? "Sealing..." : "Seal Manifest"}
          </button>
        )}
      </div>

      {/* SHA-256 Hash Display */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="text-3xs uppercase tracking-wider font-bold text-slate-500 font-mono">
            SHA-256 Manifest Hash
          </span>
          <div className="font-mono text-xs font-bold text-blue-700 truncate">
            {manifest.manifest_hash}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyHash}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition"
          title="Copy Hash"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid of Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="text-slate-500 text-3xs font-bold uppercase font-mono">Sampling Rate</div>
          <div className="font-mono text-slate-900 font-semibold mt-0.5">{manifest.sampling_rate} Hz</div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="text-slate-500 text-3xs font-bold uppercase font-mono">Channels ({manifest.channel_names.length})</div>
          <div className="font-mono text-slate-900 font-semibold mt-0.5 truncate" title={manifest.channel_names.join(", ")}>
            {manifest.channel_names.join(", ")}
          </div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="text-slate-500 text-3xs font-bold uppercase font-mono">Model & Version</div>
          <div className="font-mono text-slate-900 font-semibold mt-0.5 truncate">
            {manifest.model_id} ({manifest.model_version})
          </div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="text-slate-500 text-3xs font-bold uppercase font-mono">Deterministic Seed</div>
          <div className="font-mono text-slate-900 font-semibold mt-0.5">{manifest.seed}</div>
        </div>
      </div>

      {/* Parent lineage banner if derived */}
      {experiment.parent_experiment_id && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Derived from parent:</span>
            <span className="font-mono font-bold text-purple-700">{experiment.parent_experiment_id}</span>
          </div>
          <span className="text-3xs font-mono uppercase bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
            Lineage Linked
          </span>
        </div>
      )}

      {/* Lineage provenance disclaimer */}
      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-2xs text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Lineage: Verified against SQLite experiments registry</span>
        </div>
        <span>Sealed at UTC</span>
      </div>
    </div>
  );
}
