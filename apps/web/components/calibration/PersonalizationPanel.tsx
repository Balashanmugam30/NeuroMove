"use client";

import React, { useState } from "react";
import {
  CalibrationSession,
  PersonalizationConfig,
  PersonalizedExperimentResult,
} from "@neuromove/contracts";
import { Cpu, Sparkles, TrendingUp, TrendingDown, CheckCircle2, Play, Split } from "lucide-react";
import { Button } from "@/components/ui/Button";

import { Select } from "@/components/ui/FormControls";

interface PersonalizationPanelProps {
  session: CalibrationSession | null;
  onRunPersonalization: (config: PersonalizationConfig) => Promise<void>;
  experimentResult: PersonalizedExperimentResult | null;
  isPersonalizing?: boolean;
}

export function PersonalizationPanel({
  session,
  onRunPersonalization,
  experimentResult,
  isPersonalizing = false,
}: PersonalizationPanelProps) {
  const [modelFamily, setModelFamily] = useState<"LDA" | "SVM_LINEAR">("LDA");
  const [splitStrategy, setSplitStrategy] = useState<"TEMPORAL_BLOCK_SPLIT" | "STRATIFIED_SHUFFLE_SPLIT">("TEMPORAL_BLOCK_SPLIT");

  const canPersonalize =
    session &&
    (session.status === "QUALITY_REVIEW" || session.status === "READY") &&
    session.valid_trial_count >= 4;

  const handlePersonalize = async () => {
    if (!session) return;
    const config: PersonalizationConfig = {
      calibration_id: session.calibration_id,
      profile_id: session.profile_id,
      subject_id: session.subject_id,
      task_id: session.task_id,
      model_family: modelFamily as any,
      representation: "CSP_LOG_POWER" as any,
      csp_config: {
        csp_version: "MNE_CSP_V1",
        n_components: 4,
        cov_est: "concat",
        log: true,
        norm_trace: false,
        regularization: null,
        component_order: "mutual_info",
        transform_into: "average_power",
      },
      adaptation_strategy: "TRAIN_FROM_SCRATCH" as any,
      split_strategy: splitStrategy as any,
      train_ratio: 0.6,
      scale_features: false,
      search_config: {
        search_type: "NONE",
        n_iter: 10,
        param_grid: {},
        scoring: "balanced_accuracy",
        inner_cv_splits: 3,
      },
      random_state: 42,
    };
    await onRunPersonalization(config);
  };

  const comparison = experimentResult?.comparison_with_generic;
  const deltaBalAcc = comparison?.delta_balanced_accuracy ?? 0;
  const isPositiveDelta = deltaBalAcc >= 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Subject-Specific Model Adaptation</h3>
            <p className="text-xs text-slate-500">Train personalized CSP spatial filters & decoders on subject calibration</p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handlePersonalize}
          disabled={!canPersonalize || isPersonalizing}
          loading={isPersonalizing}
          icon={<Play className="w-4 h-4" />}
        >
          {isPersonalizing ? "Fitting Personalized Model..." : "Train Personalized Model"}
        </Button>
      </div>

      {/* Configuration Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
        <Select
          label="Model Architecture"
          value={modelFamily}
          onChange={(e) => setModelFamily(e.target.value as any)}
          disabled={isPersonalizing}
          options={[
            { value: "LDA", label: "CSP + Linear Discriminant Analysis (LDA)" },
            { value: "SVM_LINEAR", label: "CSP + Linear Support Vector Machine (SVM)" },
          ]}
        />

        <Select
          label="Evaluation Partitioning"
          value={splitStrategy}
          onChange={(e) => setSplitStrategy(e.target.value as any)}
          disabled={isPersonalizing}
          options={[
            { value: "TEMPORAL_BLOCK_SPLIT", label: "Temporal Block (Early 60% Train / Late 40% Held-Out)" },
            { value: "STRATIFIED_SHUFFLE_SPLIT", label: "Stratified Random Split (60% Train / 40% Held-Out)" },
          ]}
        />


        <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
          <div className="text-2xs font-bold text-slate-700 flex items-center gap-1">
            <Split className="w-3.5 h-3.5 text-blue-600" /> Zero Data Leakage Invariant
          </div>
          <p className="text-3xs text-slate-500 leading-relaxed">
            Spatial filters, scalers, and classifier parameters are fitted strictly on the training partition.
          </p>
        </div>
      </div>

      {/* Results View */}
      {experimentResult && comparison ? (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-600" /> Held-Out Generalization & Generic Benchmark
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Generic Baseline */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">Generic Research Baseline</div>
              <div className="text-2xl font-mono font-bold text-slate-700">
                {(comparison.generic_balanced_accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-2xs text-slate-500">
                F1 Score: <span className="font-mono font-semibold">{(comparison.generic_f1 * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Personalized Model */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="text-3xs font-semibold text-blue-800 uppercase tracking-wider">Personalized Subject Model</div>
              <div className="text-2xl font-mono font-bold text-blue-950">
                {(comparison.personalized_balanced_accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-2xs text-blue-800">
                F1 Score: <span className="font-mono font-semibold">{(comparison.personalized_f1 * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Delta Indicator */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isPositiveDelta ? "border-emerald-200 bg-emerald-50/50 text-emerald-950" : "border-amber-200 bg-amber-50/50 text-amber-950"
              }`}
            >
              <div className="text-3xs font-semibold uppercase tracking-wider flex items-center gap-1">
                {isPositiveDelta ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-amber-600" />}
                Personalization Delta (Δ)
              </div>
              <div className="text-2xl font-mono font-bold">
                {isPositiveDelta ? `+${(deltaBalAcc * 100).toFixed(1)}%` : `${(deltaBalAcc * 100).toFixed(1)}%`}
              </div>
              <div className="text-2xs">
                Δ F1: <span className="font-mono font-semibold">{comparison.delta_f1 >= 0 ? `+${(comparison.delta_f1 * 100).toFixed(1)}%` : `${(comparison.delta_f1 * 100).toFixed(1)}%`}</span>
              </div>
            </div>
          </div>

          {/* Model Registry Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-mono font-bold text-slate-900">{experimentResult.model_id}</div>
              <div className="text-3xs text-slate-500">
                Trained on {experimentResult.train_trial_count} trials • Evaluated on {experimentResult.heldout_trial_count} held-out trials
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Research Ready
            </span>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
          Run calibration protocol and press &quot;Train Personalized Model&quot; to evaluate held-out adaptation metrics.
        </div>
      )}

    </div>
  );
}
