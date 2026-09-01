"use client";

import React, { useState } from "react";
import { ModelCard } from "@neuromove/contracts";
import { ShieldAlert, Fingerprint, Copy, Check, FileText, Code2 } from "lucide-react";

interface ModelCardViewerProps {
  modelCard: ModelCard;
}

export function ModelCardViewer({ modelCard }: ModelCardViewerProps) {
  const [activeTab, setActiveTab] = useState<"structured" | "markdown">("structured");
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(modelCard.markdown_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden font-sans space-y-4">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Model Card
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-semibold">
              {modelCard.model_id}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {modelCard.task.task_name} &bull; {modelCard.model_family} &bull; {modelCard.feature_representation}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("structured")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "structured"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              Structured
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === "markdown"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 inline mr-1" />
              Markdown
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="inline-flex items-center space-x-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy MD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {activeTab === "structured" ? (
        <div className="p-6 space-y-6">
          {/* Cryptographic SHA-256 Provenance Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900 text-white text-xs">
            <div className="flex items-center space-x-2.5">
              <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200">Artifact SHA-256 Checksum:</span>
                <span className="font-mono text-[11px] text-emerald-300 ml-2">
                  {modelCard.artifact_checksum_sha256}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">Verified Lineage</span>
          </div>

          {/* Intended Use & Training Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Intended Research Purpose
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                {modelCard.intended_use}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Training Dataset & Validation
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                {modelCard.training_data_summary}
              </p>
              <p className="text-[11px] font-mono text-slate-500 pt-1">
                Protocol: {modelCard.validation_protocol}
              </p>
            </div>
          </div>

          {/* Performance Summary Metrics */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Cross-Validated Performance Benchmark
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                <span className="text-[10px] font-semibold text-blue-700 uppercase">
                  Balanced Accuracy
                </span>
                <p className="text-lg font-black text-blue-950 font-mono">
                  {((modelCard.metrics_summary.balanced_accuracy_mean ?? 0) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-blue-600 font-mono">
                  ±{((modelCard.metrics_summary.balanced_accuracy_std ?? 0) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Overall Accuracy
                </span>
                <p className="text-lg font-black text-slate-800 font-mono">
                  {((modelCard.metrics_summary.accuracy_mean ?? 0) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  ±{((modelCard.metrics_summary.accuracy_std ?? 0) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Weighted F1
                </span>
                <p className="text-lg font-black text-slate-800 font-mono">
                  {((modelCard.metrics_summary.f1_mean ?? 0) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  ±{((modelCard.metrics_summary.f1_std ?? 0) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Chance Level
                </span>
                <p className="text-lg font-black text-slate-600 font-mono">
                  {((modelCard.metrics_summary.chance_level ?? 0.5) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-400 font-mono">Theoretical</p>
              </div>
            </div>
          </div>

          {/* Limitations and Failure Modes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
              <div className="flex items-center space-x-2 text-rose-800">
                <ShieldAlert className="w-4 h-4" />
                <h5 className="text-[11px] font-bold uppercase tracking-wider">
                  Known Limitations
                </h5>
              </div>
              <ul className="text-xs text-rose-900 space-y-1 list-disc pl-4">
                {modelCard.known_limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
              <div className="flex items-center space-x-2 text-amber-800">
                <ShieldAlert className="w-4 h-4" />
                <h5 className="text-[11px] font-bold uppercase tracking-wider">
                  Failure Modes
                </h5>
              </div>
              <ul className="text-xs text-amber-900 space-y-1 list-disc pl-4">
                {modelCard.failure_modes.map((fm, i) => (
                  <li key={i}>{fm}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Software Environment Stack */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Reproducible Software Environment Stack
            </h5>
            <div className="flex flex-wrap gap-2">
              {Object.entries(modelCard.software_versions).map(([pkg, ver]) => (
                <span
                  key={pkg}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 border border-slate-200 text-slate-800"
                >
                  <span className="text-slate-500 mr-1">{pkg}:</span>
                  {ver}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
            {modelCard.markdown_content}
          </pre>
        </div>
      )}
    </div>
  );
}
