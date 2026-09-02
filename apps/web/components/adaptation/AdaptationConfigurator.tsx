"use client";

import React from "react";
import {
  AdaptationPolicy,
  AdaptationPreview,
  DataRetentionStrategy,
} from "@neuromove/contracts";
import { Sliders, CheckCircle2, AlertOctagon } from "lucide-react";

interface AdaptationConfiguratorProps {
  policies: AdaptationPolicy[];
  selectedPolicyId: string;
  onSelectPolicy: (policyId: string) => void;
  retentionStrategy: DataRetentionStrategy;
  onChangeRetentionStrategy: (strategy: DataRetentionStrategy) => void;
  preview: AdaptationPreview | null;
  isLoadingPreview: boolean;
  onRunPreview: () => void;
  onStartAdaptation: () => void;
  isStarting: boolean;
  isResearchMode?: boolean;
}

export const AdaptationConfigurator: React.FC<AdaptationConfiguratorProps> = ({
  policies,
  selectedPolicyId,
  onSelectPolicy,
  retentionStrategy,
  onChangeRetentionStrategy,
  preview,
  isLoadingPreview,
  onRunPreview,
  onStartAdaptation,
  isStarting,
}) => {

  const selectedPolicy =
    policies.find((p) => p.policy_id === selectedPolicyId) || policies[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Adaptation Governance & Policy</h3>
            <p className="text-xs text-slate-500">
              Deterministic gates for candidate evaluation and promotion
            </p>
          </div>
        </div>
      </div>

      {/* Policy Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-700">
          Select Adaptation Policy
        </label>
        <select
          value={selectedPolicy?.policy_id || ""}
          onChange={(e) => onSelectPolicy(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        >
          {policies.map((p) => (
            <option key={p.policy_id} value={p.policy_id}>
              {p.name} ({p.scope} - Max Reg: {(p.max_allowed_regression * 100).toFixed(0)}%)
            </option>
          ))}
        </select>
        {selectedPolicy?.description && (
          <p className="text-[11px] text-slate-500 italic px-1">
            {selectedPolicy.description}
          </p>
        )}
      </div>

      {/* Data Retention Strategy */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-700">
          Data Retention Strategy
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onChangeRetentionStrategy("BASELINE_PLUS_NEW")}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              retentionStrategy === "BASELINE_PLUS_NEW"
                ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold ring-1 ring-indigo-400"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <div>Baseline + New Data</div>
            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
              Retains baseline trials + appends new sessions
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChangeRetentionStrategy("NEW_DATA_ONLY")}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              retentionStrategy === "NEW_DATA_ONLY"
                ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold ring-1 ring-indigo-400"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            <div>New Data Only</div>
            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
              Trains strictly on newly acquired batch
            </div>
          </button>
        </div>
      </div>

      {/* Pre-flight Preview Section */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-700">Pre-flight Validation</span>
          <button
            onClick={onRunPreview}
            disabled={isLoadingPreview}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline disabled:opacity-50"
          >
            {isLoadingPreview ? "Validating..." : "Validate Pre-flight"}
          </button>
        </div>

        {preview && (
          <div
            className={`p-3 rounded-lg border text-xs space-y-2 ${
              preview.can_proceed
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                : "bg-amber-50/60 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {preview.can_proceed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-amber-600" />
              )}
              <span>
                {preview.can_proceed
                  ? "Pre-flight Validation Passed: Ready for Adaptation"
                  : "Validation Incomplete / Warning"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/40">
              <div>
                Training Set:{" "}
                <span className="font-semibold">
                  {preview.data_composition.total_training_trials} trials
                </span>
              </div>
              <div>
                Protected Val:{" "}
                <span className="font-semibold">
                  {preview.data_composition.protected_validation_trials} trials
                </span>
              </div>
            </div>

            {preview.compatibility_issues.length > 0 && (
              <div className="text-[11px] text-amber-700 space-y-0.5 pt-1">
                {preview.compatibility_issues.map((iss, i) => (
                  <div key={i}>• {iss}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execution Action Button */}
      <div className="pt-2">
        <button
          onClick={onStartAdaptation}
          disabled={isStarting || !preview?.can_proceed}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isStarting ? (
            <span>Fitting Candidate Model...</span>
          ) : (
            <span>Execute Controlled Adaptation</span>
          )}
        </button>
        <p className="text-[10px] text-center text-slate-400 mt-1.5">
          Zero-leakage guarantee: Candidate will NOT replace active model automatically.
        </p>
      </div>
    </div>
  );
};
