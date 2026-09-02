"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  RotateCcw,
  Play,
  CheckCircle2,
} from "lucide-react";
import {
  ResilienceLabStatus,
  FaultDefinition,
  InvariantResult,
  RecoveryCheckpoint,
  FaultExperiment,
  FailureScenarioResult,
} from "@neuromove/contracts";
import {
  fetchResilienceStatus,
  fetchActiveFaults,
  injectFault,
  clearFault,
  resetResilienceLab,
  fetchResilienceInvariants,
  fetchResilienceExperiments,
  fetchResilienceCheckpoints,
  runResilienceScenario,
  replayResilienceExperiment,
} from "@/lib/api-client";
import { ResilienceStatusCard } from "@/components/resilience/ResilienceStatusCard";
import { ActiveFaultsPanel } from "@/components/resilience/ActiveFaultsPanel";
import { ExperimentRunner } from "@/components/resilience/ExperimentRunner";
import { ExperimentTimeline } from "@/components/resilience/ExperimentTimeline";
import { InvariantMatrixTable } from "@/components/resilience/InvariantMatrixTable";
import { RecoveryDiagnosticsCard } from "@/components/resilience/RecoveryDiagnosticsCard";
import { ReplayComparisonPanel } from "@/components/resilience/ReplayComparisonPanel";

type ResilienceTab = "OVERVIEW" | "SCENARIOS" | "TIMELINE" | "INVARIANTS" | "RECOVERY";

export default function ResiliencePage() {
  const [activeTab, setActiveTab] = useState<ResilienceTab>("OVERVIEW");
  const [status, setStatus] = useState<ResilienceLabStatus | null>(null);
  const [activeFaults, setActiveFaults] = useState<FaultDefinition[]>([]);
  const [invariants, setInvariants] = useState<InvariantResult[]>([]);
  const [experiments, setExperiments] = useState<FaultExperiment[]>([]);
  const [checkpoints, setCheckpoints] = useState<RecoveryCheckpoint[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<FaultExperiment | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, faultsRes, invsRes, expsRes, chksRes] = await Promise.all([
        fetchResilienceStatus().catch(() => null),
        fetchActiveFaults().catch(() => []),
        fetchResilienceInvariants().catch(() => []),
        fetchResilienceExperiments().catch(() => []),
        fetchResilienceCheckpoints().catch(() => []),
      ]);

      if (statusRes) setStatus(statusRes);
      setActiveFaults(faultsRes);
      setInvariants(invsRes);
      setExperiments(expsRes);
      setCheckpoints(chksRes);
      if (expsRes.length > 0 && !selectedExperiment) {
        setSelectedExperiment(expsRes[0]);
      }
    } catch (err) {
      console.error("Failed to load resilience state:", err);
      setErrorMessage("Could not connect to the resilience laboratory service.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedExperiment]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleResetLab = async () => {
    setIsResetting(true);
    try {
      await resetResilienceLab();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleInjectFault = async (
    type: string,
    severity: string,
    scope: string,
    parameters: Record<string, unknown>
  ) => {
    setIsInjecting(true);
    try {
      await injectFault({
        fault_type: type as any,
        severity: severity as any,
        scope: scope as any,
        trigger_type: "MANUAL",
        parameters: parameters as any,
        description: `Controlled ${type} injection`,
      });
      await loadData();
    } catch (err: any) {
      alert(`Fault injection failed: ${err.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  const handleClearFault = async (faultId: string) => {
    try {
      await clearFault(faultId);
      await loadData();
    } catch (err: any) {
      alert(`Clear fault failed: ${err.message}`);
    }
  };

  const handleRunScenario = async (scenarioId: string): Promise<FailureScenarioResult> => {
    setIsExecuting(true);
    try {
      const res = await runResilienceScenario(scenarioId);
      await loadData();
      return res;
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReplay = async (experimentId: string) => {
    setIsReplaying(true);
    try {
      const res = await replayResilienceExperiment(experimentId);
      await loadData();
      return res;
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Failure Injection & Resilience Laboratory
              </h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300">
                Phase 18
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Controlled software fault laboratory validating fail-closed invariants, zero-allow preservation, and safe recovery
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-xs text-slate-400 animate-pulse font-medium">Syncing telemetry...</span>
            )}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Invariant #1 Certified
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {errorMessage}
          </div>
        )}

        {/* Global Status & Health KPI Card */}
        <ResilienceStatusCard
          status={status}
          onResetLab={handleResetLab}
          isResetting={isResetting}
        />

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {[
            { id: "OVERVIEW", label: "Overview & Active Faults", icon: ShieldAlert },
            { id: "SCENARIOS", label: "Scenario Lab (A—Z, AA—AH)", icon: Play },
            { id: "TIMELINE", label: "Execution Timeline", icon: Activity },
            { id: "INVARIANTS", label: "14 Invariants Matrix", icon: ShieldCheck },
            { id: "RECOVERY", label: "Recovery & Replay", icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ResilienceTab)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  isActive
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            <ActiveFaultsPanel
              faults={activeFaults}
              onInject={handleInjectFault}
              onClear={handleClearFault}
              isInjecting={isInjecting}
            />
            <ExperimentRunner
              onRunScenario={handleRunScenario}
              isExecuting={isExecuting}
            />
          </div>
        )}

        {activeTab === "SCENARIOS" && (
          <ExperimentRunner
            onRunScenario={handleRunScenario}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === "TIMELINE" && (
          <div className="space-y-6">
            {experiments.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <label className="text-xs font-medium text-slate-700">Select Experiment Record:</label>
                <select
                  value={selectedExperiment?.experiment_id || ""}
                  onChange={(e) => {
                    const found = experiments.find((x) => x.experiment_id === e.target.value);
                    if (found) setSelectedExperiment(found);
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                >
                  {experiments.map((exp) => (
                    <option key={exp.experiment_id} value={exp.experiment_id}>
                      {exp.experiment_id} — {exp.name} ({exp.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ExperimentTimeline experiment={selectedExperiment} />
          </div>
        )}

        {activeTab === "INVARIANTS" && (
          <InvariantMatrixTable invariants={invariants} />
        )}

        {activeTab === "RECOVERY" && (
          <div className="space-y-6">
            <RecoveryDiagnosticsCard
              checkpoints={checkpoints}
              latestRecoveryStatus={selectedExperiment?.recovery_status || "RECOVERED_CLEANLY"}
              dataLossStatus={selectedExperiment?.data_loss_status || "NONE"}
            />
            <ReplayComparisonPanel
              experiments={experiments}
              onReplay={handleReplay}
              isReplaying={isReplaying}
            />
          </div>
        )}
      </div>
    </div>
  );
}
