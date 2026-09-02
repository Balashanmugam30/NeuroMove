"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ConfidenceConfig,
  ConfidenceDecision,
  TemporalConfirmationDecision,
  Phase16IntentHandoffPayload,
  TemporalConfirmationState,
  ConfidenceHistoryRecord,
  TemporalConfirmationEvent,
  ConfidenceCalibrationProfile,
  CalibrationMetrics,
  CalibrationMethod,
  ConfidenceInput,
  ScoreType,
} from "@neuromove/contracts";
import {
  fetchConfidenceConfig,
  updateConfidenceConfig,
  evaluateConfidence,
  resetTemporalState,
  fetchConfidenceState,
  fetchConfidenceHistory,
  fetchTemporalEvents,
  fetchCalibrationProfile,
  calibrateModel,
  fetchConfidenceMetrics,
  runConfidenceScenario,
} from "@/lib/api-client";
import { LiveConfidenceCard } from "@/components/confidence/LiveConfidenceCard";
import { TemporalEvidencePanel } from "@/components/confidence/TemporalEvidencePanel";
import { DecisionExplanationView } from "@/components/confidence/DecisionExplanationView";
import { ConfidenceHistoryTable } from "@/components/confidence/ConfidenceHistoryTable";
import { CalibrationDiagnosticsPanel } from "@/components/confidence/CalibrationDiagnosticsPanel";
import { ConfidenceConfigEditor } from "@/components/confidence/ConfidenceConfigEditor";
import { SimulationScenarioRunner } from "@/components/confidence/SimulationScenarioRunner";
import {
  Gauge,
  Activity,
  History,
  Target,
  Sliders,
  Play,
  RefreshCw,
  AlertCircle,
} from "lucide-react";


export default function ConfidencePage() {
  const [activeTab, setActiveTab] = useState<"live" | "history" | "calibration" | "config">("live");

  // State
  const [config, setConfig] = useState<ConfidenceConfig | null>(null);
  const [temporalState, setTemporalState] = useState<TemporalConfirmationState | null>(null);
  const [decision, setDecision] = useState<ConfidenceDecision | null>(null);
  const [temporalDecision, setTemporalDecision] = useState<TemporalConfirmationDecision | null>(null);
  const [handoffPayload, setHandoffPayload] = useState<Phase16IntentHandoffPayload | null>(null);
  const [history, setHistory] = useState<ConfidenceHistoryRecord[]>([]);
  const [events, setEvents] = useState<TemporalConfirmationEvent[]>([]);
  const [calibrationProfile, setCalibrationProfile] = useState<ConfidenceCalibrationProfile | null>(null);
  const [metrics, setMetrics] = useState<CalibrationMetrics | null>(null);

  // Loading flags
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFitting, setIsFitting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [cfg, st, hist, evts, prof, met] = await Promise.all([
        fetchConfidenceConfig().catch(() => null),
        fetchConfidenceState().catch(() => null),
        fetchConfidenceHistory(50).catch(() => []),
        fetchTemporalEvents(50).catch(() => []),
        fetchCalibrationProfile("v1").catch(() => null),
        fetchConfidenceMetrics("v1").catch(() => null),
      ]);

      if (cfg) setConfig(cfg);
      if (st) setTemporalState(st.state);
      setHistory(hist || []);
      setEvents(evts || []);
      if (prof) setCalibrationProfile(prof);
      if (met) setMetrics(met);
    } catch (err: any) {
      console.error("Failed to load confidence workspace data:", err);
      setErrorBanner("Failed to connect to backend confidence services.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Actions
  const handleReset = async () => {
    try {
      setIsResetting(true);
      await resetTemporalState("MANUAL_RESET");
      const st = await fetchConfidenceState();
      setTemporalState(st.state);
      if (temporalDecision) {
        setTemporalDecision({
          ...temporalDecision,
          temporally_confirmed: false,
          temporal_status: "RESET",
          consecutive_count: 0,
          accumulated_duration_ms: 0,
        });
      }
    } catch (err: any) {
      console.error("Reset error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleStepEvaluation = async (targetPrediction: string = "LEFT_IMAGERY", score: number = 0.92) => {
    try {
      setIsEvaluating(true);
      const now = Date.now() / 1000.0;
      const inp: ConfidenceInput = {
        prediction: targetPrediction,
        raw_score: score,
        score_type: "PROBABILITY" as ScoreType,
        class_scores: {
          [targetPrediction]: score,
          RIGHT_IMAGERY: Math.max(0, 1.0 - score),
        },
        model_id: "mdl_demo_v1",
        model_version_id: "v1",
        prediction_timestamp: now,
        data_timestamp: now,
        signal_quality: 0.95,
        feature_compatibility: true,
        model_validity: "ACTIVE",
        calibration_status: "CALIBRATED",
      };

      const res = await evaluateConfidence(inp);
      setDecision(res.decision);
      setTemporalDecision(res.temporal);
      setHandoffPayload(res.handoff);

      // Refresh state & history
      const [st, hist, evts] = await Promise.all([
        fetchConfidenceState().catch(() => null),
        fetchConfidenceHistory(50).catch(() => []),
        fetchTemporalEvents(50).catch(() => []),
      ]);
      if (st) setTemporalState(st.state);
      if (hist) setHistory(hist);
      if (evts) setEvents(evts);
    } catch (err: any) {
      console.error("Evaluation error:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFitCalibration = async (method: CalibrationMethod) => {
    try {
      setIsFitting(true);
      const prof = await calibrateModel({
        model_version_id: "v1",
        uncalibrated_scores: [0.92, 0.15, 0.88, 0.79, 0.22, 0.35, 0.95, 0.10, 0.84, 0.25],
        labels: [1, 0, 1, 1, 0, 0, 1, 0, 1, 0],
        method,
        scope: "MODEL",
        dataset_reference: "held_out_validation_set",
      });
      setCalibrationProfile(prof);
      setMetrics(prof.calibration_metrics);
    } catch (err: any) {
      console.error("Calibration fitting error:", err);
    } finally {
      setIsFitting(false);
    }
  };

  const handleSaveConfig = async (updated: Partial<ConfidenceConfig>) => {
    try {
      setIsSavingConfig(true);
      const saved = await updateConfidenceConfig(updated);
      setConfig(saved);
    } catch (err: any) {
      console.error("Save config error:", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Phase 15 Engine
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-medium text-slate-500">BCI Decoding Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-600" /> Confidence Estimation & Temporal Confirmation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Deterministic prediction-confidence calibration, multi-factor electrophysiological gating, and continuous temporal persistence confirmation.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleStepEvaluation("LEFT_IMAGERY", 0.92)}
            disabled={isEvaluating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isEvaluating ? "animate-spin" : ""}`} />
            Step Prediction (92%)
          </button>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
            Reset State
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
          <Activity className="w-4 h-4" /> Live Confirmation Engine
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4" /> Telemetry & Provenance ({history.length})
        </button>

        <button
          onClick={() => setActiveTab("calibration")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "calibration"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Target className="w-4 h-4" /> Calibration Diagnostics & ECE
        </button>

        <button
          onClick={() => setActiveTab("config")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "config"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-4 h-4" /> Policy & Thresholds
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "live" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LiveConfidenceCard decision={decision} />
            <TemporalEvidencePanel
              temporalDecision={temporalDecision}
              state={temporalState}
              onReset={handleReset}
              isResetting={isResetting}
            />
          </div>

          <DecisionExplanationView
            decision={decision}
            handoffPayload={handoffPayload}
          />

          <SimulationScenarioRunner
            onRunScenario={runConfidenceScenario}
          />
        </div>
      )}

      {activeTab === "history" && (
        <ConfidenceHistoryTable
          history={history}
          events={events}
          isLoading={isLoading}
        />
      )}

      {activeTab === "calibration" && (
        <CalibrationDiagnosticsPanel
          metrics={metrics}
          profile={calibrationProfile}
          onFitCalibration={handleFitCalibration}
          isFitting={isFitting}
        />
      )}

      {activeTab === "config" && config && (
        <ConfidenceConfigEditor
          config={config}
          onSave={handleSaveConfig}
          isSaving={isSavingConfig}
        />
      )}
    </div>
  );
}
