"use client";

import React, { useEffect, useState } from "react";
import {
  AdaptationDataBatch,
  AdaptationPolicy,
  AdaptationPreview,
  AdaptationRun,
  DataRetentionStrategy,
  DriftObservation,
  ModelVersion,
} from "@neuromove/contracts";
import {
  fetchAdaptationBatches,
  fetchAdaptationModels,
  fetchAdaptationPolicies,
  fetchAdaptationPreview,
  fetchDriftDiagnostics,
  fetchModelVersionChain,
  promoteCandidateModel,
  rejectCandidateModel,
  rollbackModel,
  runAdaptationExperiment,
  createAdaptationBatch,
} from "@/lib/api-client";
import { ModelSelectorCard } from "@/components/adaptation/ModelSelectorCard";
import { DataBatchPicker } from "@/components/adaptation/DataBatchPicker";
import { AdaptationConfigurator } from "@/components/adaptation/AdaptationConfigurator";
import { AdaptationStageRunner } from "@/components/adaptation/AdaptationStageRunner";
import { CandidateComparisonMatrix } from "@/components/adaptation/CandidateComparisonMatrix";
import { PromotionPanel } from "@/components/adaptation/PromotionPanel";
import { VersionChainGraph } from "@/components/adaptation/VersionChainGraph";
import { DriftMonitorDashboard } from "@/components/adaptation/DriftMonitorDashboard";
import {
  PlayCircle,
  BarChart3,
  GitBranch,
  Activity,
  FlaskConical,
  RefreshCw,
} from "lucide-react";


type ActiveTab = "runner" | "comparison" | "governance" | "drift";

export default function AdaptationPage() {
  const [isResearchMode, setIsResearchMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("runner");

  // Domain state
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [batches, setBatches] = useState<AdaptationDataBatch[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [policies, setPolicies] = useState<AdaptationPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("pol_conservative_subject_v1");
  const [retentionStrategy, setRetentionStrategy] =
    useState<DataRetentionStrategy>("BASELINE_PLUS_NEW");

  // Execution & Diagnostics state
  const [preview, setPreview] = useState<AdaptationPreview | null>(null);
  const [currentRun, setCurrentRun] = useState<AdaptationRun | null>(null);
  const [versionChain, setVersionChain] = useState<ModelVersion[]>([]);
  const [driftData, setDriftData] = useState<DriftObservation | null>(null);

  // Loading flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [isRefreshingDrift, setIsRefreshingDrift] = useState<boolean>(false);

  // Initial Load
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [fetchedModels, fetchedPolicies, fetchedBatches, fetchedDrift] =
        await Promise.all([
          fetchAdaptationModels("SUBJECT", "sub-001"),
          fetchAdaptationPolicies(),
          fetchAdaptationBatches("sub-001"),
          fetchDriftDiagnostics("sub-001"),
        ]);

      setModels(fetchedModels);
      if (fetchedModels.length > 0) {
        const active = fetchedModels.find((m) => m.is_active) || fetchedModels[0];
        setSelectedModelId(active.model_id);
        const chain = await fetchModelVersionChain(active.model_id);
        setVersionChain(chain);
      }

      setPolicies(fetchedPolicies);
      if (fetchedPolicies.length > 0) {
        setSelectedPolicyId(fetchedPolicies[0].policy_id);
      }

      setBatches(fetchedBatches);
      if (fetchedBatches.length > 0) {
        setSelectedBatchIds([fetchedBatches[0].batch_id]);
      }

      setDriftData(fetchedDrift);
    } catch (err) {
      console.error("Failed to load adaptation initial data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handlers
  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    try {
      const chain = await fetchModelVersionChain(modelId);
      setVersionChain(chain);
    } catch (err) {
      console.error("Failed to fetch version chain:", err);
    }
  };

  const handleToggleBatch = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId]
    );
  };

  const handleSynthesizeBatch = async () => {
    try {
      const newBatch = await createAdaptationBatch({
        name: `Candidate Session ${batches.length + 1}`,
        subject_id: "sub-001",
        trial_count: 12,
        source_mode: "SIMULATION",
      });
      setBatches((prev) => [newBatch, ...prev]);
      setSelectedBatchIds((prev) => [...prev, newBatch.batch_id]);
    } catch (err) {
      console.error("Failed to synthesize candidate batch:", err);
    }
  };

  const handleRunPreview = async () => {
    if (!selectedModelId || selectedBatchIds.length === 0 || !selectedPolicyId)
      return;
    try {
      setIsLoadingPreview(true);
      const res = await fetchAdaptationPreview({
        base_model_id: selectedModelId,
        data_batch_ids: selectedBatchIds,
        policy_id: selectedPolicyId,
        scope: "SUBJECT",
        subject_id: "sub-001",
      });
      setPreview(res);
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleStartAdaptation = async () => {
    if (!selectedModelId || selectedBatchIds.length === 0 || !selectedPolicyId)
      return;
    try {
      setIsStarting(true);
      const run = await runAdaptationExperiment({
        base_model_id: selectedModelId,
        data_batch_ids: selectedBatchIds,
        policy_id: selectedPolicyId,
        scope: "SUBJECT",
        subject_id: "sub-001",
      });
      setCurrentRun(run);
      // Auto-switch to comparison tab upon completion
      if (run.comparison) {
        setActiveTab("comparison");
      }
    } catch (err) {
      console.error("Adaptation run failed:", err);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePromote = async (notes?: string) => {
    if (!currentRun) return;
    try {
      setIsProcessingAction(true);
      const res = await promoteCandidateModel({
        adaptation_id: currentRun.adaptation_id,
        operator_notes: notes,
      });
      // Refresh models & version chain
      const updatedModels = await fetchAdaptationModels("SUBJECT", "sub-001");
      setModels(updatedModels);
      setSelectedModelId(res.promoted_model.model_id);
      const chain = await fetchModelVersionChain(res.promoted_model.model_id);
      setVersionChain(chain);
      setCurrentRun((prev) =>
        prev
          ? {
              ...prev,
              status: "PROMOTED",
              promotion_decision: {
                decision: "PROMOTED",
                operator_action: res.decision.operator_action,
                reasons: res.decision.reasons,
                timestamp: res.decision.timestamp,
              },
            }
          : null
      );
    } catch (err) {
      console.error("Promotion failed:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!currentRun) return;
    try {
      setIsProcessingAction(true);
      const res = await rejectCandidateModel({
        adaptation_id: currentRun.adaptation_id,
        rejection_reason: reason,
      });
      setCurrentRun((prev) =>
        prev
          ? {
              ...prev,
              status: "REJECTED",
              promotion_decision: {
                decision: "REJECTED",
                operator_action: res.decision.operator_action,
                reasons: res.decision.reasons,
                timestamp: res.decision.timestamp,
              },
            }
          : null
      );
    } catch (err) {
      console.error("Rejection failed:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRollback = async (targetModelId: string, reason: string) => {
    try {
      setIsProcessingAction(true);
      const res = await rollbackModel({
        target_model_id: targetModelId,
        reason,
      });
      const updatedModels = await fetchAdaptationModels("SUBJECT", "sub-001");
      setModels(updatedModels);
      setSelectedModelId(res.active_model.model_id);
      const chain = await fetchModelVersionChain(res.active_model.model_id);
      setVersionChain(chain);
    } catch (err) {
      console.error("Rollback failed:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRefreshDrift = async (inject: boolean) => {
    try {
      setIsRefreshingDrift(true);
      const updated = await fetchDriftDiagnostics("sub-001", inject);
      setDriftData(updated);
    } catch (err) {
      console.error("Drift refresh failed:", err);
    } finally {
      setIsRefreshingDrift(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* Top Header */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Phase 14
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Adaptive Learning & Controlled Model Update Pipeline
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            Controlled, auditable, reversible, and versioned subject-specific model adaptation with zero data leakage guarantees and explicit promotion gates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsResearchMode(!isResearchMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              isResearchMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            {isResearchMode ? "Research Mode" : "Product Mode"}
          </button>
          <button
            onClick={loadInitialData}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Reload Workspace"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Interactive Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto scrollbar-none">
        <button

          onClick={() => setActiveTab("runner")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "runner"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          <span>Controlled Adaptation Runner</span>
        </button>

        <button
          onClick={() => setActiveTab("comparison")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "comparison"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Candidate Evaluation & Comparison</span>
          {currentRun?.comparison && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "governance"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Promotion & Version Lineage</span>
        </button>

        <button
          onClick={() => setActiveTab("drift")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "drift"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Drift & Research Diagnostics</span>
        </button>
      </div>

      {/* Tab 1: Controlled Adaptation Runner */}
      {activeTab === "runner" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ModelSelectorCard
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={handleSelectModel}
              isResearchMode={isResearchMode}
            />
            <DataBatchPicker
              batches={batches}
              selectedBatchIds={selectedBatchIds}
              onToggleBatch={handleToggleBatch}
              onSynthesizeBatch={handleSynthesizeBatch}
              isResearchMode={isResearchMode}
            />
            <AdaptationConfigurator
              policies={policies}
              selectedPolicyId={selectedPolicyId}
              onSelectPolicy={setSelectedPolicyId}
              retentionStrategy={retentionStrategy}
              onChangeRetentionStrategy={setRetentionStrategy}
              preview={preview}
              isLoadingPreview={isLoadingPreview}
              onRunPreview={handleRunPreview}
              onStartAdaptation={handleStartAdaptation}
              isStarting={isStarting}
              isResearchMode={isResearchMode}
            />
          </div>

          <AdaptationStageRunner
            currentRun={currentRun}
            isResearchMode={isResearchMode}
          />
        </div>
      )}

      {/* Tab 2: Candidate Evaluation & Comparison */}
      {activeTab === "comparison" && (
        <div className="space-y-5">
          <CandidateComparisonMatrix
            comparison={currentRun?.comparison ?? null}
            isResearchMode={isResearchMode}
          />
          {currentRun?.promotion_eligibility && (
            <PromotionPanel
              currentRun={currentRun}
              onPromote={handlePromote}
              onReject={handleReject}
              isProcessing={isProcessingAction}
              isResearchMode={isResearchMode}
            />
          )}
        </div>
      )}

      {/* Tab 3: Promotion & Version Lineage */}
      {activeTab === "governance" && (
        <div className="space-y-5">
          <PromotionPanel
            currentRun={currentRun}
            onPromote={handlePromote}
            onReject={handleReject}
            isProcessing={isProcessingAction}
            isResearchMode={isResearchMode}
          />
          <VersionChainGraph
            versions={versionChain}
            onRollback={handleRollback}
            isProcessing={isProcessingAction}
            isResearchMode={isResearchMode}
          />
        </div>
      )}

      {/* Tab 4: Drift & Research Diagnostics */}
      {activeTab === "drift" && (
        <div className="space-y-5">
          <DriftMonitorDashboard
            driftData={driftData}
            onRefreshDrift={handleRefreshDrift}
            isRefreshing={isRefreshingDrift}
            isResearchMode={isResearchMode}
          />
        </div>
      )}
    </div>
  );
}
