"use client";

import React from "react";
import {
  DecoderPipelineConfig,
  ClassifierType,
  EvaluationProtocol,
} from "@neuromove/contracts";
import { Sliders, Cpu, GitBranch, Layers } from "lucide-react";

interface PipelineConfiguratorProps {
  config: DecoderPipelineConfig;
  onChange: (updated: DecoderPipelineConfig) => void;
  availableEpochSets: Array<{ epoch_set_id: string; total_events: number; source_kind: string }>;
  disabled?: boolean;
}

export const PipelineConfigurator: React.FC<PipelineConfiguratorProps> = ({
  config,
  onChange,
  availableEpochSets,
  disabled = false,
}) => {
  const handleCSPChange = (n_components: number) => {
    onChange({
      ...config,
      csp_config: {
        ...config.csp_config,
        n_components,
      },
    });
  };

  const handleClassifierChange = (classifier_type: ClassifierType) => {
    onChange({
      ...config,
      classifier_config: {
        ...config.classifier_config,
        classifier_type,
      },
    });
  };

  const handleProtocolChange = (evaluation_protocol: EvaluationProtocol) => {
    const evaluation_mode =
      evaluation_protocol === "WITHIN_SUBJECT_K_FOLD"
        ? "INTRA_SUBJECT"
        : "INTER_SUBJECT";
    onChange({
      ...config,
      evaluation_protocol,
      evaluation_mode,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Sliders className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          2. Pipeline Hyperparameters & Cross-Validation
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Source Epoch Set */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Source Epoch Set
          </label>
          <select
            value={config.epoch_set_id}
            onChange={(e) =>
              onChange({ ...config, epoch_set_id: e.target.value })
            }
            disabled={disabled}
            className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {availableEpochSets.map((set) => (
              <option key={set.epoch_set_id} value={set.epoch_set_id}>
                {set.epoch_set_id} ({set.total_events} epochs, {set.source_kind})
              </option>
            ))}
          </select>
        </div>

        {/* CSP Components */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            CSP Spatial Components
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 4, 6, 8].map((comp) => (
              <button
                key={comp}
                type="button"
                onClick={() => handleCSPChange(comp)}
                disabled={disabled}
                className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  config.csp_config.n_components === comp
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 block">
            Log-power spatial filters
          </span>
        </div>

        {/* Classical Classifier */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            Classifier Algorithm
          </label>
          <select
            value={config.classifier_config.classifier_type}
            onChange={(e) =>
              handleClassifierChange(e.target.value as ClassifierType)
            }
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="LDA">Linear Discriminant Analysis (LDA)</option>
            <option value="SVM_LINEAR">Support Vector Machine (Linear SVM)</option>
            <option value="SVM_RBF">Support Vector Machine (RBF SVM)</option>
            <option value="DUMMY">Dummy Baseline (Prior / Chance)</option>
          </select>
          <span className="text-[10px] text-slate-400 block">
            Fitted inside training fold only
          </span>
        </div>

        {/* Evaluation Protocol */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-slate-500" />
            Evaluation Protocol
          </label>
          <select
            value={config.evaluation_protocol}
            onChange={(e) =>
              handleProtocolChange(e.target.value as EvaluationProtocol)
            }
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="LEAVE_ONE_SUBJECT_OUT">
              Leave-One-Subject-Out (Inter-Subject)
            </option>
            <option value="GROUP_K_FOLD">Group K-Fold (Inter-Subject)</option>
            <option value="STRATIFIED_GROUP_K_FOLD">
              Stratified Group K-Fold (Inter-Subject)
            </option>
            <option value="WITHIN_SUBJECT_K_FOLD">
              Within-Subject K-Fold (Intra-Subject)
            </option>
          </select>
          <span className="text-[10px] text-teal-600 font-medium block">
            Zero subject-level test leakage
          </span>
        </div>
      </div>
    </div>
  );
};
