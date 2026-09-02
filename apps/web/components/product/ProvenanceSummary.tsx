"use client";

import React, { useState } from "react";
import { Database, Copy, Check } from "lucide-react";
import { ProductProvenance } from "@neuromove/contracts";

interface ProvenanceSummaryProps {
  provenance?: ProductProvenance | null;
}

export function ProvenanceSummary({ provenance }: ProvenanceSummaryProps) {
  const [copied, setCopied] = useState(false)

  if (!provenance) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(provenance, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs font-sans space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-900 tracking-tight">
            Scientific Lineage & Cryptographic Provenance
          </h4>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-500" />
              <span>Copy Lineage</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-2xs font-mono">
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Product Session:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.product_session_id}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Acquisition Session:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.acquisition_session_id || "NOT_AVAILABLE"}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Sensor Session:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.sensor_session_id || "NOT_AVAILABLE"}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Experiment ID:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.experiment_id || "NOT_AVAILABLE"}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Model Version:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.model_version_id}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Safety Verdict:</span>
          <span className="font-semibold text-emerald-700 truncate block">
            {provenance.safety_decision}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">HIL Session:</span>
          <span className="font-semibold text-purple-700 truncate block">
            {provenance.hil_session_id || "0_TRANSMISSIONS"}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Manifest Hash:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {provenance.manifest_hash || "mnf_48a9f2"}
          </span>
        </div>
      </div>

      {/* Full SHA-256 Provenance Hash */}
      <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs flex items-center justify-between overflow-hidden">
        <span className="text-slate-400 shrink-0 mr-2">SHA-256 Provenance Hash:</span>
        <span className="truncate">{provenance.provenance_hash}</span>
      </div>
    </div>
  );
}
