"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  IntentStateSnapshot,
  IntentRecord,
  IntentStateTransition,
  IntentPolicy,
  IntentIngestRequest,
} from "@neuromove/contracts";
import {
  fetchIntentState,
  fetchCurrentIntent,
  fetchIntentHistory,
  fetchIntentRecords,
  fetchIntentPolicy,
  updateIntentPolicy,
  ingestIntentHandoff,
  cancelIntent,
  completeIntent,
  resetIntentState,
  runIntentScenario,
} from "@/lib/api-client";
import { CurrentIntentCard } from "@/components/intent/CurrentIntentCard";
import { IntentLifecycleTimeline } from "@/components/intent/IntentLifecycleTimeline";
import { TransitionExplanationPanel } from "@/components/intent/TransitionExplanationPanel";
import { IntentHistoryTable } from "@/components/intent/IntentHistoryTable";
import { IntentPolicyEditor } from "@/components/intent/IntentPolicyEditor";
import { IntentSimulationLab } from "@/components/intent/IntentSimulationLab";
import {
  Workflow,
  Activity,
  History,
  FlaskConical,
  Sliders,
  Play,
  RefreshCw,
  AlertCircle,
  Zap,
} from "lucide-react";

export default function IntentPage() {
  const [activeTab, setActiveTab] = useState<"live" | "history" | "simulation" | "policy">("live");

  // State
  const [snapshot, setSnapshot] = useState<IntentStateSnapshot | null>(null);
  const [currentIntent, setCurrentIntent] = useState<IntentRecord | null>(null);
  const [transitions, setTransitions] = useState<IntentStateTransition[]>([]);
  const [records, setRecords] = useState<IntentRecord[]>([]);
  const [policy, setPolicy] = useState<IntentPolicy | null>(null);

  // Loading flags
  const [, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [snap, curr, hist, recs, pol] = await Promise.all([
        fetchIntentState().catch(() => null),
        fetchCurrentIntent().catch(() => null),
        fetchIntentHistory(50).catch(() => []),
        fetchIntentRecords(50).catch(() => []),
        fetchIntentPolicy().catch(() => null),
      ]);

      if (snap) setSnapshot(snap);
      if (curr) setCurrentIntent(curr);
      setTransitions(hist || []);
      setRecords(recs || []);
      if (pol) setPolicy(pol);
    } catch (err: any) {
      console.error("Failed to load intent state machine data:", err);
      setErrorBanner("Failed to connect to backend intent state services.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Actions
  const handleIngestConfirmed = async (targetClass: string = "LEFT_IMAGERY") => {
    try {
      setIsActionLoading(true);
      const req: IntentIngestRequest = {
        prediction: targetClass,
        confidence: 0.92,
        confidence_band: "HIGH",
        eligibility: "VALID",
        temporal_status: "CONFIRMED",
        temporally_confirmed: true,
        confirmation_reason: "Manual research trigger",
        model_version_id: "v1",
        subject_id: "sub-001",
        session_id: "ses-001",
        evidence_window_count: 3,
        evidence_duration_ms: 750.0,
      };
      const updatedSnap = await ingestIntentHandoff(req);
      setSnapshot(updatedSnap);

      // Refresh records and transitions
      const [curr, hist, recs] = await Promise.all([
        fetchCurrentIntent().catch(() => null),
        fetchIntentHistory(50).catch(() => []),
        fetchIntentRecords(50).catch(() => []),
      ]);
      setCurrentIntent(curr);
      setTransitions(hist);
      setRecords(recs);
    } catch (err: any) {
      console.error("Ingest confirmed error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleIngestCandidate = async () => {
    try {
      setIsActionLoading(true);
      const req: IntentIngestRequest = {
        prediction: "RIGHT_IMAGERY",
        confidence: 0.82,
        confidence_band: "HIGH",
        eligibility: "VALID",
        temporal_status: "TRACKING",
        temporally_confirmed: false,
        confirmation_reason: "Evidence tracking",
        model_version_id: "v1",
        subject_id: "sub-001",
        session_id: "ses-001",
        evidence_window_count: 1,
        evidence_duration_ms: 250.0,
      };

      const updatedSnap = await ingestIntentHandoff(req);
      setSnapshot(updatedSnap);

      const [curr, hist, recs] = await Promise.all([
        fetchCurrentIntent().catch(() => null),
        fetchIntentHistory(50).catch(() => []),
        fetchIntentRecords(50).catch(() => []),
      ]);
      setCurrentIntent(curr);
      setTransitions(hist);
      setRecords(recs);
    } catch (err: any) {
      console.error("Ingest candidate error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setIsActionLoading(true);
      const updatedSnap = await completeIntent();
      setSnapshot(updatedSnap);
      setCurrentIntent(null);
      const hist = await fetchIntentHistory(50);
      setTransitions(hist);
    } catch (err: any) {
      console.error("Complete intent error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsActionLoading(true);
      const updatedSnap = await cancelIntent();
      setSnapshot(updatedSnap);
      setCurrentIntent(null);
      const hist = await fetchIntentHistory(50);
      setTransitions(hist);
    } catch (err: any) {
      console.error("Cancel intent error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsActionLoading(true);
      const updatedSnap = await resetIntentState();
      setSnapshot(updatedSnap);
      setCurrentIntent(null);
      const hist = await fetchIntentHistory(50);
      setTransitions(hist);
    } catch (err: any) {
      console.error("Reset intent error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSavePolicy = async (updated: Partial<IntentPolicy>) => {
    try {
      setIsActionLoading(true);
      const saved = await updateIntentPolicy(updated);
      setPolicy(saved);
    } catch (err: any) {
      console.error("Save policy error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Phase 16 Engine
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-medium text-slate-500">Canonical Intent Lifecycle</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Workflow className="w-6 h-6 text-blue-600" /> Canonical Intent State Machine & Lifecycle
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Authoritative finite state machine governing intent candidate promotion, confirmation acceptance, active maintenance, and auditable transitions before Phase 17 safety arbitration.
          </p>
        </div>

        {/* Quick Trigger Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleIngestConfirmed("LEFT_IMAGERY")}
            disabled={isActionLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
            Ingest Confirmed (LEFT)
          </button>
          <button
            onClick={handleIngestCandidate}
            disabled={isActionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            Ingest Candidate (RIGHT)
          </button>
          <button
            onClick={handleReset}
            disabled={isActionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorBanner && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {errorBanner}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "live"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" /> Live Intent State Machine
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4" /> Transitions & Audit ({transitions.length})
        </button>

        <button
          onClick={() => setActiveTab("simulation")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "simulation"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FlaskConical className="w-4 h-4" /> Deterministic Scenario Lab
        </button>

        <button
          onClick={() => setActiveTab("policy")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "policy"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-4 h-4" /> Lifecycle Policy & Timers
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "live" && (
        <div className="space-y-6">
          <CurrentIntentCard
            snapshot={snapshot}
            currentIntent={currentIntent}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onReset={handleReset}
            isActionLoading={isActionLoading}
          />

          <IntentLifecycleTimeline
            currentState={snapshot?.current_state || "NO_INTENT"}
          />

          <TransitionExplanationPanel
            snapshot={snapshot}
            lastTransition={transitions[0]}
          />

          <IntentSimulationLab
            onRunScenario={runIntentScenario}
          />
        </div>
      )}

      {activeTab === "history" && (
        <IntentHistoryTable
          transitions={transitions}
          records={records}
        />
      )}


      {activeTab === "simulation" && (
        <IntentSimulationLab
          onRunScenario={runIntentScenario}
        />
      )}

      {activeTab === "policy" && policy && (
        <IntentPolicyEditor
          policy={policy}
          onSave={handleSavePolicy}
          isSaving={isActionLoading}
        />
      )}
    </div>
  );
}
