"use client";

import React, { useState } from "react";
import {
  ExperimentConfig,
  ExperimentPreview,
  ExperimentDetail,
  ModelFamily,
  FeatureRepresentation,
  EvaluationProtocol,
} from "@neuromove/contracts";
import { SearchConfigurator } from "./SearchConfigurator";
import { previewAiExperiment, runAiExperiment } from "@/lib/api-client";
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  Eye,
  Loader2,
} from "lucide-react";


interface ExperimentBuilderProps {
  epochSets: string[];
  onExperimentCompleted: (detail: ExperimentDetail) => void;
}

export function ExperimentBuilder({
  epochSets,
  onExperimentCompleted,
}: ExperimentBuilderProps) {
  const [config, setConfig] = useState<ExperimentConfig>({
    experiment_version: "AI_EXPERIMENT_V1",
    dataset_id: "synthetic_sim_v1",
    epoch_set_id: epochSets[0] || "ep_synthetic_v1",
    task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    representation: "CSP_LOG_POWER",
    model_family: "LDA",
    model_config: {},
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
    evaluation_protocol: "LEAVE_ONE_SUBJECT_OUT",
    evaluation_mode: "INTER_SUBJECT",
    n_splits: 5,
    scale_features: false,
    search_config: {
      search_type: "NONE",
      param_grid: {},
      scoring: "balanced_accuracy",
      inner_cv_splits: 3,
      n_iter: 10,
    },

    channels: [],
    random_state: 42,
  });

  const [preview, setPreview] = useState<ExperimentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setErrorMsg(null);
    try {
      const res = await previewAiExperiment(config);
      setPreview(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Preview request failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecute = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const detail = await runAiExperiment(config);
      onExperimentCompleted(detail);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Experiment execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-blue-600" />
            <span>AI Experiment Design &amp; Hyperparameter Studio</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure group-aware cross-validation, feature extraction, and nested hyperparameter exploration.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
          AI_EXPERIMENT_V1
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Epoch Set Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Source Epoch Set
          </label>
          <select
            value={config.epoch_set_id}
            onChange={(e) => {
              setConfig({ ...config, epoch_set_id: e.target.value });
              setPreview(null);
            }}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {epochSets.map((es) => (
              <option key={es} value={es}>
                {es}
              </option>
            ))}
            {epochSets.length === 0 && (
              <option value="ep_synthetic_v1">ep_synthetic_v1 (Simulated)</option>
            )}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Segmented motor imagery epoch bundle.
          </p>
        </div>

        {/* Task Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Classification Task
          </label>
          <select
            value={config.task_id}
            onChange={(e) => {
              setConfig({ ...config, task_id: e.target.value });
              setPreview(null);
            }}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1">
              Left Hand vs Right Hand (C3 vs C4)
            </option>
            <option value="FEET_VS_FISTS_V1">
              Feet vs Both Fists (Cz vs Lateral)
            </option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Binary sensorimotor rhythm decoding target.
          </p>
        </div>

        {/* Model Family Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Model Family
          </label>
          <select
            value={config.model_family}
            onChange={(e) => {
              setConfig({
                ...config,
                model_family: e.target.value as ModelFamily,
              });
              setPreview(null);
            }}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="LDA">Linear Discriminant Analysis (LDA)</option>
            <option value="SVM_LINEAR">Linear Support Vector Machine (Linear SVM)</option>
            <option value="SVM_RBF">RBF Support Vector Machine (Kernel SVM)</option>
            <option value="LOGISTIC_REGRESSION">Logistic Regression (L2 Regularized)</option>
            <option value="RANDOM_FOREST">Random Forest Classifier</option>
            <option value="DUMMY">Dummy Classifier (Empirical Chance Baseline)</option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Core mathematical learning algorithm.
          </p>
        </div>

        {/* Feature Representation */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Feature Representation
          </label>
          <select
            value={config.representation}
            onChange={(e) => {
              setConfig({
                ...config,
                representation: e.target.value as FeatureRepresentation,
              });
              setPreview(null);
            }}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="CSP_LOG_POWER">MNE Common Spatial Patterns (Log Power)</option>
            <option value="BAND_POWER">Multi-Band Power (Alpha / Beta Bands)</option>
            <option value="COVARIANCE">Spatial Covariance Matrices</option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Spatial or spectral feature transformation.
          </p>
        </div>

        {/* Evaluation Protocol */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Evaluation Protocol
          </label>
          <select
            value={config.evaluation_protocol}
            onChange={(e) => {
              setConfig({
                ...config,
                evaluation_protocol: e.target.value as EvaluationProtocol,
              });
              setPreview(null);
            }}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="LEAVE_ONE_SUBJECT_OUT">Leave-One-Subject-Out (Inter-Subject)</option>
            <option value="STRATIFIED_GROUP_KFOLD">Stratified Group K-Fold</option>
            <option value="GROUP_KFOLD">Group K-Fold</option>
            <option value="CROSS_SESSION">Leave-One-Session-Out</option>
            <option value="WITHIN_SUBJECT_KFOLD">Within-Subject Stratified K-Fold</option>
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Group partitioning protocol ensuring zero data leakage.
          </p>
        </div>

        {/* CSP Components */}
        {config.representation === "CSP_LOG_POWER" && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              CSP Spatial Filters
            </label>
            <select
              value={config.csp_config.n_components}
              onChange={(e) => {
                setConfig({
                  ...config,
                  csp_config: {
                    ...config.csp_config,
                    n_components: parseInt(e.target.value),
                  },
                });
                setPreview(null);
              }}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="2">2 Components (1 per class)</option>
              <option value="4">4 Components (2 per class)</option>
              <option value="6">6 Components (3 per class)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Paired extreme spatial filter eigenvalues.
            </p>
          </div>
        )}
      </div>

      {/* Hyperparameter Search Configurator */}
      <SearchConfigurator
        modelFamily={config.model_family}
        config={config.search_config}
        onChange={(newSearch) => {
          setConfig({ ...config, search_config: newSearch });
          setPreview(null);
        }}
        disabled={isRunning}
      />

      {/* Pre-Flight Preview Banner */}
      {preview && (
        <div
          className={`p-4 rounded-xl border space-y-2 ${
            preview.valid
              ? "bg-blue-50/50 border-blue-200 text-blue-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <h5 className="text-xs font-bold uppercase tracking-wider">
                Pre-Flight Inspection Passed
              </h5>
            </div>
            <span className="text-[11px] font-mono font-bold">
              {preview.eligible_epochs} Trials Eligible &bull; {preview.subject_count} Subjects &bull; {preview.expected_outer_folds} Outer Folds
            </span>
          </div>

          {preview.warnings.length > 0 && (
            <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={isPreviewing || isRunning}
          onClick={handlePreview}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          {isPreviewing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Checking Dataset...</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Pre-Flight Inspection</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={handleExecute}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing Nested CV &amp; Search...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run AI Experiment</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
