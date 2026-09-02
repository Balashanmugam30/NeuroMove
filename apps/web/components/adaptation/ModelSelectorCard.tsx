"use client";

import React from "react";
import { ModelVersion } from "@neuromove/contracts";
import { Shield, CheckCircle2, History } from "lucide-react";


interface ModelSelectorCardProps {
  models: ModelVersion[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  isResearchMode: boolean;
}

export const ModelSelectorCard: React.FC<ModelSelectorCardProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  isResearchMode,
}) => {
  const activeModel = models.find((m) => m.is_active) || models[0];
  const selectedModel = models.find((m) => m.model_id === selectedModelId) || activeModel;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Incumbent Base Model</h3>
            <p className="text-xs text-slate-500">Currently deployed research model checkpoint</p>
          </div>
        </div>
        {selectedModel?.is_active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Active Research
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <History className="w-3.5 h-3.5" />
            Historical Version {selectedModel?.version_number}
          </span>
        )}
      </div>

      {/* Model Selector Dropdown */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Select Base Model for Adaptation
        </label>
        <select
          value={selectedModel?.model_id || ""}
          onChange={(e) => onSelectModel(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {models.map((m) => (
            <option key={m.model_id} value={m.model_id}>
              {m.model_id} (v{m.version_number} - {m.subject_id || "Population"}{" "}
              {m.is_active ? "★ ACTIVE" : ""})
            </option>
          ))}
        </select>
      </div>

      {selectedModel && (
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Balanced Acc
            </span>
            <span className="text-lg font-bold text-slate-900">
              {((selectedModel.metrics.balanced_accuracy ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              F1-Score
            </span>
            <span className="text-lg font-bold text-slate-900">
              {((selectedModel.metrics.f1 ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Accuracy
            </span>
            <span className="text-lg font-bold text-slate-900">
              {((selectedModel.metrics.accuracy ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {isResearchMode && selectedModel && (
        <div className="bg-slate-50/80 border border-slate-200/60 rounded-lg p-3 space-y-1.5 text-xs text-slate-600 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Architecture:</span>
            <span className="font-semibold text-slate-800">
              {selectedModel.model_family} + {selectedModel.representation}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">SHA-256 Digest:</span>
            <span className="text-slate-700 truncate max-w-[180px]">
              {selectedModel.artifact_checksum_sha256}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Parent Version:</span>
            <span className="text-slate-700">{selectedModel.parent_model_id || "Root (v1)"}</span>
          </div>
        </div>
      )}
    </div>
  );
};
