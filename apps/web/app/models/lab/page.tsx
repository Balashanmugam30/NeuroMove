"use client";

import React, { useState, useEffect } from "react";
import {
  ExperimentDetail,
  ExperimentSummary,
  AblationStudyResult,
  ModelComparisonResult,
  ModelCard,
  EpochSummary,
} from "@neuromove/contracts";
import {
  fetchAiExperiments,
  fetchAiExperimentDetail,
  runAiAblationStudy,
  compareAiModels,
  fetchAiModelCard,
  fetchEpochSets,
} from "@/lib/api-client";
import { ExperimentBuilder } from "@/components/lab/ExperimentBuilder";
import { SearchCandidateTable } from "@/components/lab/SearchCandidateTable";
import { ErrorAnalysisTable } from "@/components/lab/ErrorAnalysisTable";
import { PerSessionBarChart } from "@/components/lab/PerSessionBarChart";
import { ModelComparisonTable } from "@/components/lab/ModelComparisonTable";
import { AblationStudyView } from "@/components/lab/AblationStudyView";
import { ModelCardViewer } from "@/components/lab/ModelCardViewer";
import {
  FlaskConical,
  GitCompare,
  GitFork,
  FileCheck2,
  Trophy,
  Loader2,
  CheckCircle2,
  BrainCircuit,
  Sparkles,
} from "lucide-react";



export default function AIModelLaboratoryPage() {
  const [activeTab, setActiveTab] = useState<
    "builder" | "comparison" | "ablations" | "registry"
  >("builder");

  const [epochSets, setEpochSets] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [selectedExperiment, setSelectedExperiment] =
    useState<ExperimentDetail | null>(null);
  const [selectedComparison, setSelectedComparison] =
    useState<ModelComparisonResult | null>(null);
  const [selectedAblation, setSelectedAblation] =
    useState<AblationStudyResult | null>(null);
  const [selectedModelCard, setSelectedModelCard] = useState<ModelCard | null>(
    null
  );

  const [comparisonExpIds, setComparisonExpIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [isAblating, setIsAblating] = useState(false);


  useEffect(() => {
    async function loadInitial() {
      try {
        const epData = await fetchEpochSets(20);
        const epIds = epData.map((e: EpochSummary) => e.epoch_set_id);
        setEpochSets(epIds);
      } catch {
        setEpochSets(["ep_synthetic_v1"]);
      }


      try {
        const exps = await fetchAiExperiments();
        setExperiments(exps);
        if (exps.length > 0) {
          const firstDetail = await fetchAiExperimentDetail(exps[0].experiment_id);
          setSelectedExperiment(firstDetail);
          const firstCard = await fetchAiModelCard(firstDetail.model_id).catch(() => null);
          if (firstCard) setSelectedModelCard(firstCard);
          setComparisonExpIds(exps.slice(0, 3).map((e: ExperimentSummary) => e.experiment_id));
        }
      } catch {
        // silent initial fallback
      }
    }
    loadInitial();
  }, []);


  const handleExperimentCompleted = async (detail: ExperimentDetail) => {
    setSelectedExperiment(detail);
    try {
      const updated = await fetchAiExperiments();
      setExperiments(updated);
      const card = await fetchAiModelCard(detail.model_id).catch(() => null);
      if (card) setSelectedModelCard(card);
    } catch {
      // silent
    }
  };

  const handleSelectExperiment = async (expId: string) => {
    try {
      const detail = await fetchAiExperimentDetail(expId);
      setSelectedExperiment(detail);
      const card = await fetchAiModelCard(detail.model_id).catch(() => null);
      if (card) setSelectedModelCard(card);
    } catch {
      // silent
    }
  };

  const handleRunComparison = async () => {
    if (comparisonExpIds.length < 2) return;
    setIsComparing(true);
    try {
      const res = await compareAiModels({
        comparison_name: "Model Architecture Comparison",
        experiment_ids: comparisonExpIds,
      });
      setSelectedComparison(res);
    } catch {
      // silent
    } finally {
      setIsComparing(false);
    }
  };

  const handleRunAblation = async (variable: string) => {
    if (!selectedExperiment) return;
    setIsAblating(true);
    try {
      const res = await runAiAblationStudy({
        baseline_experiment_config: selectedExperiment.config,
        ablation_variable: variable,
      });
      setSelectedAblation(res);
    } catch {
      // silent
    } finally {
      setIsAblating(false);
    }
  };

  const handleViewCard = async (modelId: string) => {
    try {
      const card = await fetchAiModelCard(modelId);
      setSelectedModelCard(card);
      setActiveTab("registry");
    } catch {
      // silent
    }
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  AI Model Laboratory &amp; Rigorous Evaluation
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Phase 12
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Leakage-free nested cross-validation, hyperparameter exploration, out-of-fold error analysis, and cryptographic model provenance.
              </p>
            </div>
          </div>
        </div>

        {/* Operating Invariant Badges */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Zero Data Leakage
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            SHA-256 Provenance
          </span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 bg-slate-100/60 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab("builder")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "builder"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>Experiment Lab &amp; Search</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("comparison");
            if (!selectedComparison && comparisonExpIds.length >= 2) {
              handleRunComparison();
            }
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "comparison"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GitCompare className="w-4 h-4" />
          <span>Model Comparison ({experiments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ablations")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "ablations"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>Ablation Studies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("registry")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "registry"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Model Cards &amp; Registry</span>
        </button>
      </div>

      {/* Tab Content 1: Experiment Lab & Search */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          <ExperimentBuilder
            epochSets={epochSets}
            onExperimentCompleted={handleExperimentCompleted}
          />

          {/* Detailed Experiment Results Inspector */}
          {selectedExperiment && (
            <div className="space-y-6 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-blue-600" />
                    <span>Cross-Validation Results &amp; Analytics</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Experiment: <span className="font-mono text-slate-800 font-bold">{selectedExperiment.experiment_id}</span> &bull; Model: <span className="font-mono text-slate-800">{selectedExperiment.model_id}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleViewCard(selectedExperiment.model_id)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-all"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Inspect Model Card</span>
                </button>
              </div>

              {/* KPI Score Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Balanced Accuracy
                  </span>
                  <p className="text-2xl font-black text-blue-600 font-mono mt-1">
                    {(selectedExperiment.metrics.balanced_accuracy.mean * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ±{(selectedExperiment.metrics.balanced_accuracy.std * 100).toFixed(1)}% std
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Weighted F1 Score
                  </span>
                  <p className="text-2xl font-black text-slate-800 font-mono mt-1">
                    {(selectedExperiment.metrics.f1.mean * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ±{(selectedExperiment.metrics.f1.std * 100).toFixed(1)}% std
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Overall Accuracy
                  </span>
                  <p className="text-2xl font-black text-slate-800 font-mono mt-1">
                    {(selectedExperiment.metrics.accuracy.mean * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Chance: {(selectedExperiment.metrics.chance_level * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Outer Folds Evaluated
                  </span>
                  <p className="text-2xl font-black text-slate-800 font-mono mt-1">
                    {selectedExperiment.folds.length}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedExperiment.subjects.length} Subjects
                  </p>
                </div>
              </div>

              {/* Inner CV Search Candidates (if search was executed) */}
              {selectedExperiment.folds[0]?.inner_search_result && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Inner Cross-Validation Search Candidates (Fold 1)
                    </h4>
                  </div>
                  <SearchCandidateTable
                    candidates={selectedExperiment.folds[0].inner_search_result.candidates}
                  />

                </div>
              )}

              {/* Per-Session Analytics & Error Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Session Generalization
                  </h4>
                  <PerSessionBarChart
                    metrics={selectedExperiment.per_session_metrics}
                    chanceLevel={selectedExperiment.metrics.chance_level}
                  />
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Aggregate Confusion Matrix
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs font-mono">
                      <thead className="text-[10px] text-slate-400">
                        <tr>
                          <th className="p-2 text-left">True \ Pred</th>
                          {selectedExperiment.metrics.confusion_matrix.labels.map((l) => (
                            <th key={l} className="p-2 font-bold text-slate-700">
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExperiment.metrics.confusion_matrix.matrix.map((row, rIdx) => (
                          <tr key={rIdx} className="border-t border-slate-100">
                            <td className="p-2 font-bold text-left text-slate-700">
                              {selectedExperiment.metrics.confusion_matrix.labels[rIdx]}
                            </td>
                            {row.map((val, cIdx) => {
                              const normVal =
                                selectedExperiment.metrics.confusion_matrix.normalized_matrix[rIdx][cIdx];
                              const isDiag = rIdx === cIdx;
                              return (
                                <td
                                  key={cIdx}
                                  className={`p-3 rounded font-bold ${
                                    isDiag
                                      ? "bg-blue-100 text-blue-900"
                                      : "bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {val} ({(normVal * 100).toFixed(0)}%)
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Out of Fold Error Analysis */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Out-of-Fold Misclassification Analytics
                </h4>
                <ErrorAnalysisTable analysis={selectedExperiment.error_analysis} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Multi-Model Comparison */}
      {activeTab === "comparison" && (
        <div className="space-y-6">
          {/* Experiment Multiselect Checkboxes */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Experiments to Compare
                </h4>
                <p className="text-xs text-slate-500">
                  Select 2 or more experiments sharing the same task and evaluation protocol.
                </p>
              </div>
              <button
                type="button"
                disabled={comparisonExpIds.length < 2 || isComparing}
                onClick={handleRunComparison}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Comparing...</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Run Comparison</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {experiments.map((exp) => {
                const isChecked = comparisonExpIds.includes(exp.experiment_id);
                return (
                  <label
                    key={exp.experiment_id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? "bg-blue-50/60 border-blue-400 ring-1 ring-blue-400"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setComparisonExpIds([...comparisonExpIds, exp.experiment_id]);
                        } else {
                          setComparisonExpIds(
                            comparisonExpIds.filter((id) => id !== exp.experiment_id)
                          );
                        }
                      }}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 font-mono">
                        {exp.model_family}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {exp.experiment_id.slice(0, 14)}...
                      </p>
                      <p className="text-[11px] font-mono text-blue-700 font-bold mt-1">
                        Bal Acc: {(exp.balanced_accuracy_mean * 100).toFixed(1)}%
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {selectedComparison && (
            <ModelComparisonTable comparison={selectedComparison} />
          )}
        </div>
      )}

      {/* Tab Content 3: Ablation Studies */}
      {activeTab === "ablations" && (
        <AblationStudyView
          ablationResult={selectedAblation}
          onRunAblation={handleRunAblation}
          isSubmitting={isAblating}
        />
      )}

      {/* Tab Content 4: Model Cards & Registry */}
      {activeTab === "registry" && (
        <div className="space-y-6">
          {/* Registered Models List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Persisted Model Artifacts &amp; Cryptographic Manifests
            </h4>
            <div className="divide-y divide-slate-100">
              {experiments.map((exp) => (
                <div
                  key={exp.experiment_id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold font-mono text-slate-900">
                      mdl_{exp.experiment_id}
                    </span>
                    <p className="text-slate-500 text-[11px]">
                      {exp.model_family} &bull; {exp.representation} &bull; Task: {exp.task_id}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-blue-700 font-bold mr-2">
                      Bal Acc: {(exp.balanced_accuracy_mean * 100).toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectExperiment(exp.experiment_id);
                        setActiveTab("builder");
                      }}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      Load in Lab
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewCard(`mdl_${exp.experiment_id}`)}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      View Model Card
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {selectedModelCard && <ModelCardViewer modelCard={selectedModelCard} />}
        </div>
      )}
    </div>
  );
}
