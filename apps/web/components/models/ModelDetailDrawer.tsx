"use client";

import React from "react";
import { ModelManifest } from "@neuromove/contracts";
import { X, ShieldCheck, Cpu, Layers, Hash, FileText } from "lucide-react";


interface ModelDetailDrawerProps {
  manifest: ModelManifest | null;
  onClose: () => void;
}

export const ModelDetailDrawer: React.FC<ModelDetailDrawerProps> = ({
  manifest,
  onClose,
}) => {
  if (!manifest) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Model Provenance & Lineage
              </h3>
              <span className="text-xs font-mono text-slate-500">
                {manifest.model_id}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Cryptographic Integrity */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Hash className="w-4 h-4 text-blue-600" />
              <span>Artifact Cryptographic Fingerprint</span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200 break-all select-all">
              SHA-256: {manifest.artifact_checksum_sha256}
            </div>
            <div className="text-[11px] text-slate-500">
              Path: <span className="font-mono">{manifest.artifact_file_path}</span>
            </div>
          </div>

          {/* Dataset & Epoch Lineage */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Upstream Data Lineage</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                  Source Epoch Set
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {manifest.source_epoch_set_id}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                  Dataset ID
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {manifest.dataset_id || "SYNTHETIC_SIMULATION"}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                  Sampling Rate
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {manifest.sampling_rate_hz} Hz
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                  Subjects ({manifest.subjects.length})
                </span>
                <span className="font-mono text-slate-800 truncate block">
                  {manifest.subjects.join(", ")}
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline & Estimator Parameters */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-500" />
              <span>Pipeline & Classifier Hyperparameters</span>
            </h4>
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Spatial Filter</span>
                <span className="font-mono font-semibold text-slate-800">
                  CSP ({manifest.csp_config.n_components} components, log-power)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Classifier Algorithm</span>
                <span className="font-mono font-semibold text-slate-800">
                  {manifest.classifier_config.classifier_type} (
                  {manifest.classifier_config.solver || manifest.classifier_config.kernel})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Evaluation Protocol</span>
                <span className="font-mono font-semibold text-blue-700">
                  {manifest.evaluation_protocol} ({manifest.evaluation_mode})
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Channels Used</span>
                <span className="font-mono text-slate-800">
                  {manifest.channels.join(", ")}
                </span>
              </div>
            </div>
          </div>

          {/* Software Environment Versions */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Reproducibility Software Stack</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              {Object.entries(manifest.software_versions).map(([pkg, ver]) => (
                <div
                  key={pkg}
                  className="p-2 rounded bg-slate-50 border border-slate-200 text-center"
                >
                  <div className="text-slate-400 text-[10px] uppercase">{pkg}</div>
                  <div className="font-bold text-slate-800">{ver}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Created: {new Date(manifest.created_at).toLocaleString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
