"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Sliders,
  History,
  FlaskConical,
  Activity,
  Send,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  SafetyEvaluation,
  SafetyPolicy,
  SafetyStateSnapshot,
  SafetyTransition,
  SafetyDiagnostics,
} from "@neuromove/contracts";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import {
  fetchSafetyStateSnapshot,
  fetchSafetyPolicy,
  updateSafetyPolicy,
  evaluateSafetyIntent,
  fetchSafetyEvaluationHistory,
  fetchSafetyTransitions,
  assertSafetyOperatorHold,
  releaseSafetyOperatorHold,
  assertSafetyEmergencyStop,
  clearSafetyEmergencyStop,
  executeSafetyReset,
  assertSafetyLockout,
  unlockSafetyLockout,
  fetchSafetyDiagnostics,
  runSafetyScenario,
} from "@/lib/api-client";
import { CurrentSafetyCard } from "@/components/safety/CurrentSafetyCard";
import { SafetyRuleMatrixTable } from "@/components/safety/SafetyRuleMatrixTable";
import { SafetyTimeline } from "@/components/safety/SafetyTimeline";
import { SafetyHistoryTable } from "@/components/safety/SafetyHistoryTable";
import { SafetyPolicyEditor } from "@/components/safety/SafetyPolicyEditor";
import { SafetySimulationLab } from "@/components/safety/SafetySimulationLab";

export default function SafetyWorkspacePage() {
  const [activeTab, setActiveTab] = useState<"live" | "rules" | "history" | "lab" | "invariants">("live");

  // Subsystem Data State
  const [snapshot, setSnapshot] = useState<SafetyStateSnapshot | null>(null);
  const [policy, setPolicy] = useState<SafetyPolicy | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<SafetyEvaluation | null>(null);
  const [evaluations, setEvaluations] = useState<SafetyEvaluation[]>([]);
  const [transitions, setTransitions] = useState<SafetyTransition[]>([]);
  const [diagnostics, setDiagnostics] = useState<SafetyDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  // Intent Candidate Injection Form
  const [candidateIntentClass, setCandidateIntentClass] = useState<string>("LEFT");
  const [candidateState, setCandidateState] = useState<string>("ACTIVE");
  const [candidateAgeOffset, setCandidateAgeOffset] = useState<number>(50);

  // Load All Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [snap, pol, hist, trans, diag] = await Promise.all([
        fetchSafetyStateSnapshot().catch(() => null),
        fetchSafetyPolicy().catch(() => null),
        fetchSafetyEvaluationHistory(50).catch(() => []),
        fetchSafetyTransitions(50).catch(() => []),
        fetchSafetyDiagnostics().catch(() => null),
      ]);

      if (snap) setSnapshot(snap);
      if (pol) setPolicy(pol);
      if (hist.length > 0) {
        setEvaluations(hist);
        setLatestEvaluation(hist[0]);
      }
      if (trans.length > 0) setTransitions(trans);
      if (diag) setDiagnostics(diag);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time safety stream
  useRealtimeStream("safety", (msg) => {
    if (msg.event?.payload) {
      loadData();
    }
  });

  // Operator Controls
  const handleEmergencyStop = async () => {
    const s = await assertSafetyEmergencyStop({ reason: "Operator manual software E-stop." });
    setSnapshot(s);
    loadData();
  };

  const handleClearEmergencyStop = async () => {
    const s = await clearSafetyEmergencyStop();
    setSnapshot(s);
    loadData();
  };

  const handleToggleHold = async (hold: boolean) => {
    const s = hold ? await assertSafetyOperatorHold() : await releaseSafetyOperatorHold();
    setSnapshot(s);
    loadData();
  };

  const handleReset = async () => {
    const s = await executeSafetyReset({ clear_lockout: true });
    setSnapshot(s);
    loadData();
  };

  const handleLockout = async () => {
    const s = await assertSafetyLockout({ reason: "Operator engaged manual lockout." });
    setSnapshot(s);
    loadData();
  };

  const handleUnlock = async () => {
    const s = await unlockSafetyLockout();
    setSnapshot(s);
    loadData();
  };

  const handleSavePolicy = async (p: SafetyPolicy) => {
    const updated = await updateSafetyPolicy(p);
    setPolicy(updated);
    loadData();
  };

  // Test Intent Evaluation
  const handleEvaluateTestIntent = async () => {
    try {
      setEvaluating(true);
      const now = Date.now();
      const updatedTs = new Date(now - candidateAgeOffset).toISOString();

      const candidateIntent = {
        intent_id: `int_test_${Math.random().toString(36).slice(2, 8)}`,
        intent_class: candidateIntentClass,
        state: candidateState,
        current_state: candidateState,
        subject_id: "sub-01",
        session_id: "sess-01",
        model_version_id: "model_v1",
        confidence_score: 0.91,
        confidence_evaluation_id: "conf_eval_test",
        temporal_confirmation_id: "tc_test_01",
        created_at: updatedTs,
        updated_at: updatedTs,
      };

      const result = await evaluateSafetyIntent({ intent_snapshot: candidateIntent });
      setLatestEvaluation(result);
      loadData();
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              Phase 17
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Safety Architecture & Execution Gate
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Safety Arbitration & Constraint Evaluation Gate
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Deterministic software safety gate arbitrating Phase 16 intent lifecycle states against 13 modular
            constraints, fail-safe precedence rules, rate limits, and fail-closed policies before downstream execution.
          </p>
        </div>

        <button
          onClick={() => loadData()}
          disabled={loading}
          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-sm self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Gate</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("live")}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === "live"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Gate & Arbitration</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === "rules"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Rule Matrix & Policy</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit & Transitions</span>
        </button>

        <button
          onClick={() => setActiveTab("lab")}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === "lab"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Simulation Lab (A—O)</span>
        </button>

        <button
          onClick={() => setActiveTab("invariants")}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === "invariants"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Invariants & Diagnostics</span>
        </button>
      </div>

      {/* Tab 1: Live Gate */}
      {activeTab === "live" && (
        <div className="space-y-6">
          <CurrentSafetyCard
            snapshot={snapshot}
            onEmergencyStop={handleEmergencyStop}
            onClearEmergencyStop={handleClearEmergencyStop}
            onToggleHold={handleToggleHold}
            onReset={handleReset}
            onLockout={handleLockout}
            onUnlock={handleUnlock}
            loading={loading}
          />

          {/* On-Demand Intent Candidate Evaluation Trigger */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  Evaluate Intent Candidate
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inject candidate intent payload into safety arbitration gate for live constraint validation.
                </p>
              </div>

              <button
                onClick={handleEvaluateTestIntent}
                disabled={evaluating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                {evaluating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{evaluating ? "Evaluating..." : "Evaluate Candidate"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Intent Class</label>
                <select
                  value={candidateIntentClass}
                  onChange={(e) => setCandidateIntentClass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="LEFT">LEFT (Allowlisted)</option>
                  <option value="RIGHT">RIGHT (Allowlisted)</option>
                  <option value="FORWARD">FORWARD (Allowlisted)</option>
                  <option value="BACKWARD">BACKWARD (Allowlisted)</option>
                  <option value="REST">REST (Blocked)</option>
                  <option value="STOP">STOP (Blocked)</option>
                  <option value="UNCERTAIN">UNCERTAIN (Blocked)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Phase 16 Lifecycle State</label>
                <select
                  value={candidateState}
                  onChange={(e) => setCandidateState(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Eligible)</option>
                  <option value="CONFIRMED">CONFIRMED (Ineligible)</option>
                  <option value="CANDIDATE">CANDIDATE (Ineligible)</option>
                  <option value="NO_INTENT">NO_INTENT (Ineligible)</option>
                  <option value="COMPLETED">COMPLETED (Ineligible)</option>
                  <option value="EXPIRED">EXPIRED (Ineligible)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Intent Latency Offset: {candidateAgeOffset}ms
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={candidateAgeOffset}
                  onChange={(e) => setCandidateAgeOffset(parseInt(e.target.value, 10))}
                  className="w-full mt-2"
                />
              </div>
            </div>
          </div>

          {/* 13 Rules Matrix for latest evaluation */}
          <SafetyRuleMatrixTable evaluation={latestEvaluation} />
        </div>
      )}

      {/* Tab 2: Rule Matrix & Policy */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <SafetyPolicyEditor policy={policy} onSavePolicy={handleSavePolicy} loading={loading} />
          <SafetyRuleMatrixTable evaluation={latestEvaluation} />
        </div>
      )}

      {/* Tab 3: Audit & History */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SafetyHistoryTable
              evaluations={evaluations}
              onSelectEvaluation={(item) => setLatestEvaluation(item)}
              loading={loading}
            />
          </div>
          <div>
            <SafetyTimeline transitions={transitions} loading={loading} />
          </div>
        </div>
      )}

      {/* Tab 4: Simulation Lab */}
      {activeTab === "lab" && (
        <SafetySimulationLab onRunScenario={(id) => runSafetyScenario(id)} />
      )}

      {/* Tab 5: Invariants & Diagnostics */}
      {activeTab === "invariants" && (
        <div className="space-y-6">
          {/* Operational Diagnostics Counters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-slate-500 font-medium">Evaluations</span>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {diagnostics?.evaluation_count ?? 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-emerald-600 font-medium">Authorized</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                {diagnostics?.authorized_count ?? 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-amber-600 font-medium">Held</span>
              <p className="text-2xl font-bold text-amber-600 mt-1 font-mono">
                {diagnostics?.held_count ?? 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-rose-600 font-medium">Denied</span>
              <p className="text-2xl font-bold text-rose-600 mt-1 font-mono">
                {diagnostics?.denied_count ?? 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-red-600 font-medium">Emergency Stops</span>
              <p className="text-2xl font-bold text-red-600 mt-1 font-mono">
                {diagnostics?.emergency_stop_count ?? 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
              <span className="text-xs text-purple-600 font-medium">Lockouts</span>
              <p className="text-2xl font-bold text-purple-600 mt-1 font-mono">
                {diagnostics?.lockout_count ?? 0}
              </p>
            </div>
          </div>

          {/* Invariants Certification Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Safety Arbitration Invariant Certification
            </h3>
            <p className="text-xs text-slate-600">
              Formal verification checklist certifying fail-closed execution constraints in compliance with Phase 17.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Principle A: Fail-Closed Validity</h4>
                  <p className="text-slate-600 mt-0.5">
                    Unknown, missing, degraded, or stale data strictly yields DENIED or HELD. Never allows on partial state.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Principle B: Explicit Authorization</h4>
                  <p className="text-slate-600 mt-0.5">
                    Active Phase 16 intent state never equals execution clearance. An explicit Phase 17 evaluation token is mandatory.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Principle C: Backend Authoritative</h4>
                  <p className="text-slate-600 mt-0.5">
                    All state machine transitions, constraint calculations, and lockouts are owned by the backend.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Principle D: Fail-Safe Precedence</h4>
                  <p className="text-slate-600 mt-0.5">
                    Multi-violation conflict resolution enforces strict priority: E-Stop &gt; Lockout &gt; Invalid &gt; Health &gt; Hard Constraints &gt; Stale &gt; Hold &gt; Authorized.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Principle E: Clear Requires Reset</h4>
                  <p className="text-slate-600 mt-0.5">
                    Clearing an emergency stop or unlocking moves strictly to RESET_PENDING. Requires explicit verified reset before returning to SAFE_IDLE.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900">Scope Boundary: Software Gate Only</h4>
                  <p className="text-slate-600 mt-0.5">
                    Zero physical actuator, motor, or ESP32 commands executed. Gate terminates at auditable authorization token.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
