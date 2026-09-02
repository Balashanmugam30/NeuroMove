"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import {
  AblationRun,
  ResearchExperiment,
  RobustnessRun,
} from "@neuromove/contracts";
import {
  fetchResearchExperiments,
  createResearchExperiment,
  sealResearchExperiment,
  runResearchExperiment,
  runResearchAblation,
  runResearchRobustness,
  checkResearchReproducibility,
  exportResearchArtifact,
  runResearchScenario,
} from "@/lib/api-client";
import {
  ManifestInspector,
  ReplayStageTimeline,
  ScientificMetricsPanel,
  LatencyPercentileChart,
  AblationSweepWorkspace,
  RobustnessStressTest,
  ReproducibilityAuditPanel,
  GoldenScenariosRunner,
  ArtifactExportHub,
} from "@/components/research";
import {
  Play,
  Shield,
  Plus,
  Layers,
  Sparkles,
  RefreshCw,
  GitFork,
  Activity,
  CheckCircle2,
} from "lucide-react";

export default function ResearchLabPage() {
  const { operatingMode } = useMode();

  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<ResearchExperiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningReplay, setIsRunningReplay] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [isAblating, setIsAblating] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [trialCount, setTrialCount] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<"REPLAY" | "ABLATION" | "ROBUSTNESS" | "AUDIT" | "SCENARIOS" | "EXPORTS">("REPLAY");

  const [ablationHistory, setAblationHistory] = useState<AblationRun[]>([]);
  const [sweepResults, setSweepResults] = useState<RobustnessRun[]>([]);

  // Load experiments on mount
  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    setIsLoading(true);
    try {
      const data = await fetchResearchExperiments();
      setExperiments(data);
      if (data.length > 0) {
        setSelectedExperiment(data[0]);
      }
    } catch {
      // Fallback mock baseline for offline preview
      const mockExp: ResearchExperiment = {
        experiment_id: "exp_baseline_benchmark_01",
        title: "Baseline Motor Imagery CSP+LDA Benchmark",
        description: "Reference offline calibration benchmark with strict non-actuation verification.",
        analysis_type: "BENCHMARK",
        status: "READY",
        replay_mode: "DETERMINISTIC_ACCELERATED",
        source_session_ids: ["sess_mi_sub01_01", "sess_mi_sub01_02"],
        dataset_id: "ds_mi_standard",
        grouping_strategy: "GROUP_BY_SUBJECT",
        manifest: {
          manifest_id: "man_baseline_01",
          experiment_id: "exp_baseline_benchmark_01",
          app_version: "1.0.0",
          git_commit: "63c8584",
          source_session_ids: ["sess_mi_sub01_01", "sess_mi_sub01_02"],
          source_checksums: { sess_mi_sub01_01: "chk_sub01_01", sess_mi_sub01_02: "chk_sub01_02" },
          channel_names: ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"],
          sampling_rate: 250,
          montage: "10_20_STANDARD",
          clock_config: { normalization: "INTERPOLATED_UNIFORM" },
          qc_config: { flatline_threshold_uv: 0.1, saturation_threshold_uv: 450.0 },
          dsp_config: { lowcut: 8.0, highcut: 30.0, notch: 50.0, order: 4 },
          epoch_config: { tmin: 0.5, tmax: 2.5, baseline: [-0.5, 0.0] },
          feature_config: { methods: ["BAND_POWER_MU", "BAND_POWER_BETA"] },
          csp_config: { n_components: 4 },
          model_id: "lda_csp_mi_v1",
          model_version: "1.0.0",
          personalization_profile: { enabled: true, adaptation_rate: 0.05 },
          adaptation_state: { mode: "ONLINE_EMA", alpha: 0.95 },
          confidence_policy: { threshold: 0.80, confirmation_window_ms: 250 },
          intent_policy: { mode: "VELOCITY_MODULATED" },
          safety_policy: { strict_boundary: true },
          hil_profile: { target: "ESP32_EMULATOR_VIRTUAL" },
          seed: 42,
          numerical_tolerances: { absolute: 0.0001, relative: 0.001 },
          analysis_parameters: {},
          export_version: "1.0.0",
          is_sealed: true,
          manifest_hash: "3a7b9c4d8e1f029384756abcdef1234567890abcdef1234567890abcdef123456",
          created_at: new Date().toISOString(),
          sealed_at: new Date().toISOString(),
        },
        stages: [
          { stage: "SOURCE", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.4, configuration_hash: "cfg_01", stage_checksum: "src_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "ACQUISITION", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.1, configuration_hash: "cfg_01", stage_checksum: "acq_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "CLOCK", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.3, configuration_hash: "cfg_01", stage_checksum: "clk_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "QC", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.7, configuration_hash: "cfg_01", stage_checksum: "qc_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "DSP", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.4, configuration_hash: "cfg_01", stage_checksum: "dsp_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "EPOCH", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.8, configuration_hash: "cfg_01", stage_checksum: "ep_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "FEATURES", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.6, configuration_hash: "cfg_01", stage_checksum: "ft_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "CSP", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.2, configuration_hash: "cfg_01", stage_checksum: "csp_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "MODEL", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.5, configuration_hash: "cfg_01", stage_checksum: "mdl_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "PERSONALIZATION", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.5, configuration_hash: "cfg_01", stage_checksum: "pers_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "ADAPTATION", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.6, configuration_hash: "cfg_01", stage_checksum: "adp_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "CONFIDENCE", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.4, configuration_hash: "cfg_01", stage_checksum: "cnf_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "INTENT", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 0.5, configuration_hash: "cfg_01", stage_checksum: "int_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "SAFETY", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 1.2, configuration_hash: "cfg_01", stage_checksum: "sft_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
          { stage: "HIL", status: "PASSED", input_count: 30, output_count: 30, rejected_count: 0, latency_ms: 2.1, configuration_hash: "cfg_01", stage_checksum: "hil_hash_01", warnings: [], errors: [], metadata: {}, timestamp: new Date().toISOString() },
        ],
        metrics: {
          experiment_id: "exp_baseline_benchmark_01",
          accuracy: 0.90,
          balanced_accuracy: 0.895,
          precision_macro: 0.89,
          recall_macro: 0.90,
          f1_macro: 0.895,
          per_class_precision: { MOVE_FORWARD: 0.92, TURN_LEFT: 0.88, TURN_RIGHT: 0.89, STOP: 0.91 },
          per_class_recall: { MOVE_FORWARD: 0.91, TURN_LEFT: 0.90, TURN_RIGHT: 0.88, STOP: 0.91 },
          per_class_f1: { MOVE_FORWARD: 0.915, TURN_LEFT: 0.89, TURN_RIGHT: 0.885, STOP: 0.91 },
          confusion_matrix: {
            classes: ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT", "STOP"],
            matrix: [[7, 0, 1, 0], [0, 7, 0, 1], [1, 0, 6, 0], [0, 0, 0, 8]],
            normalized_matrix: [[0.875, 0, 0.125, 0], [0, 0.875, 0, 0.125], [0.14, 0, 0.86, 0], [0, 0, 0, 1.0]],
            total_samples: 30,
          },
          expected_calibration_error: 0.042,
          brier_score: 0.081,
          roc_auc_macro: 0.94,
          pr_auc_macro: 0.93,
          total_trials: 30,
          evaluated_trials: 30,
          rejected_trials: 0,
          rejection_rate: 0.0,
          evaluated_at: new Date().toISOString(),
        },
        latency_analytics: {
          per_stage: {
            SOURCE: { min_ms: 0.3, max_ms: 0.6, mean_ms: 0.4, median_ms: 0.4, p50_ms: 0.4, p90_ms: 0.5, p95_ms: 0.6, p99_ms: 0.6, sample_count: 30 },
            ACQUISITION: { min_ms: 0.9, max_ms: 1.4, mean_ms: 1.1, median_ms: 1.1, p50_ms: 1.1, p90_ms: 1.3, p95_ms: 1.4, p99_ms: 1.4, sample_count: 30 },
            DSP: { min_ms: 1.1, max_ms: 1.8, mean_ms: 1.4, median_ms: 1.4, p50_ms: 1.4, p90_ms: 1.7, p95_ms: 1.8, p99_ms: 1.8, sample_count: 30 },
            FEATURES: { min_ms: 1.2, max_ms: 2.1, mean_ms: 1.6, median_ms: 1.6, p50_ms: 1.6, p90_ms: 1.9, p95_ms: 2.0, p99_ms: 2.1, sample_count: 30 },
            CSP: { min_ms: 0.9, max_ms: 1.6, mean_ms: 1.2, median_ms: 1.2, p50_ms: 1.2, p90_ms: 1.5, p95_ms: 1.6, p99_ms: 1.6, sample_count: 30 },
            MODEL: { min_ms: 1.1, max_ms: 1.9, mean_ms: 1.5, median_ms: 1.5, p50_ms: 1.5, p90_ms: 1.8, p95_ms: 1.9, p99_ms: 1.9, sample_count: 30 },
            SAFETY: { min_ms: 0.8, max_ms: 1.5, mean_ms: 1.2, median_ms: 1.2, p50_ms: 1.2, p90_ms: 1.4, p95_ms: 1.5, p99_ms: 1.5, sample_count: 30 },
            HIL: { min_ms: 1.5, max_ms: 2.8, mean_ms: 2.1, median_ms: 2.1, p50_ms: 2.1, p90_ms: 2.6, p95_ms: 2.7, p99_ms: 2.8, sample_count: 30 },
          },
          total_pipeline: {
            min_ms: 7.8,
            max_ms: 18.2,
            mean_ms: 14.2,
            median_ms: 14.0,
            p50_ms: 14.0,
            p90_ms: 16.8,
            p95_ms: 17.5,
            p99_ms: 18.2,
            sample_count: 30,
          },
        },
        is_sealed: true,
        result_hash: "9f8e7d6c5b4a3210fedcba0987654321fedcba0987654321fedcba0987654321",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setExperiments([mockExp]);
      setSelectedExperiment(mockExp);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    try {
      const exp = await createResearchExperiment({
        title: `Research Study ${experiments.length + 1}`,
        description: "Evaluative offline MI benchmark",
        analysis_type: "BENCHMARK",
        seed: 42,
      });
      setExperiments((prev) => [exp, ...prev]);
      setSelectedExperiment(exp);
    } catch {
      // Offline fallback
    }
  };

  const handleSeal = async () => {
    if (!selectedExperiment) return;
    setIsSealing(true);
    try {
      const sealed = await sealResearchExperiment(selectedExperiment.experiment_id);
      setSelectedExperiment(sealed);
      setExperiments((prev) => prev.map((e) => (e.experiment_id === sealed.experiment_id ? sealed : e)));
    } catch {
      // Handle error
    } finally {
      setIsSealing(false);
    }
  };

  const handleRunReplay = async () => {
    if (!selectedExperiment) return;
    setIsRunningReplay(true);
    try {
      const updated = await runResearchExperiment(selectedExperiment.experiment_id, trialCount);
      setSelectedExperiment(updated);
      setExperiments((prev) => prev.map((e) => (e.experiment_id === updated.experiment_id ? updated : e)));
    } catch {
      // Fallback
    } finally {
      setIsRunningReplay(false);
    }
  };

  const handleRunAblation = async (ablationType: string, delta: Record<string, any>) => {
    if (!selectedExperiment) return;
    setIsAblating(true);
    try {
      const { child_experiment, ablation_record } = await runResearchAblation(
        selectedExperiment.experiment_id,
        ablationType,
        delta
      );
      setAblationHistory((prev) => [ablation_record, ...prev]);
      setExperiments((prev) => [child_experiment, ...prev]);
      setSelectedExperiment(child_experiment);
    } catch {
      // Fallback
    } finally {
      setIsAblating(false);
    }
  };

  const handleRunRobustness = async (pType: string, levels: number[]) => {
    if (!selectedExperiment) return;
    setIsSweeping(true);
    try {
      const results = await runResearchRobustness(selectedExperiment.experiment_id, pType, levels);
      setSweepResults(results);
    } catch {
      // Fallback
    } finally {
      setIsSweeping(false);
    }
  };

  const handleRunAudit = async () => {
    if (!selectedExperiment) return;
    setIsAuditing(true);
    try {
      const audit = await checkResearchReproducibility(selectedExperiment.experiment_id);
      setSelectedExperiment((prev) => (prev ? { ...prev, reproducibility: audit } : prev));
    } catch {
      // Fallback
    } finally {
      setIsAuditing(false);
    }
  };

  const handleExport = async (artType: string) => {
    if (!selectedExperiment) throw new Error("No experiment selected");
    return await exportResearchArtifact(selectedExperiment.experiment_id, artType);
  };

  const handleScenario = async (scId: string) => {
    return await runResearchScenario(scId);
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Research & Evidence"
        title="Research Lab & Scientific Evaluation Platform"
        description="Deterministic replay, multi-stage provenance, scientific classification & calibration metrics, ablations, robustness sweeps, and reproducibility audits."
        mode={operatingMode}
      />

      {/* Strict Non-Actuation Notice */}
      <Notice variant="success">
        <div className="flex items-center gap-2 font-semibold">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Strict Non-Actuation Guarantee Enforced:</span>
        </div>
        <div className="text-xs text-slate-300 mt-1">
          Research replay and analytics operates strictly in an observational evaluation boundary. Downstream HIL dispatches exclusively to the Phase 20 ESP32 virtual emulator. Zero physical motors, relays, or PWM lines are energized.
        </div>
      </Notice>

      {/* Experiment Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs uppercase font-bold text-slate-500 font-mono">Select Experiment:</label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> Loading...
            </div>
          ) : (
            <select
              value={selectedExperiment?.experiment_id || ""}
              onChange={(e) => {
                const exp = experiments.find((x) => x.experiment_id === e.target.value);
                if (exp) setSelectedExperiment(exp);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-blue-500 font-sans"
            >
              {experiments.map((e) => (
                <option key={e.experiment_id} value={e.experiment_id}>
                  {e.title} ({e.experiment_id.slice(0, 12)}...)
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleCreateExperiment}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Experiment
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-3xs uppercase font-bold text-slate-500 font-mono">Trials:</span>
            <input
              type="number"
              min={10}
              max={100}
              value={trialCount}
              onChange={(e) => setTrialCount(Number(e.target.value))}
              className="w-16 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono text-center"
            />
          </div>

          <button
            type="button"
            onClick={handleRunReplay}
            disabled={isRunningReplay || !selectedExperiment}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningReplay ? "animate-spin" : ""}`} />
            {isRunningReplay ? "Replaying Stages..." : "Run Replay Benchmark"}
          </button>
        </div>
      </div>

      {/* Manifest & Provenance Header */}
      {selectedExperiment && (
        <ManifestInspector
          experiment={selectedExperiment}
          onSeal={handleSeal}
          isSealing={isSealing}
        />
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 flex space-x-2 overflow-x-auto pb-1">
        {[
          { id: "REPLAY", label: "Replay & Metrics", icon: Layers },
          { id: "ABLATION", label: "Ablation Studies", icon: GitFork },
          { id: "ROBUSTNESS", label: "Robustness Sweeps", icon: Activity },
          { id: "AUDIT", label: "Reproducibility Audit", icon: CheckCircle2 },
          { id: "SCENARIOS", label: "12 Golden Scenarios", icon: Sparkles },
          { id: "EXPORTS", label: "Artifacts & Exports", icon: RefreshCw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === "REPLAY" && selectedExperiment && (
        <div className="space-y-6">
          <ReplayStageTimeline stages={selectedExperiment.stages} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScientificMetricsPanel metrics={selectedExperiment.metrics} />
            <LatencyPercentileChart latency={selectedExperiment.latency_analytics} />
          </div>
        </div>
      )}

      {activeTab === "ABLATION" && selectedExperiment && (
        <AblationSweepWorkspace
          experiment={selectedExperiment}
          onRunAblation={handleRunAblation}
          isAblating={isAblating}
          ablationHistory={ablationHistory}
        />
      )}

      {activeTab === "ROBUSTNESS" && (
        <RobustnessStressTest
          onRunSweep={handleRunRobustness}
          isSweeping={isSweeping}
          sweepResults={sweepResults}
        />
      )}

      {activeTab === "AUDIT" && selectedExperiment && (
        <ReproducibilityAuditPanel
          audit={selectedExperiment.reproducibility}
          onRunAudit={handleRunAudit}
          isAuditing={isAuditing}
        />
      )}

      {activeTab === "SCENARIOS" && (
        <GoldenScenariosRunner onRunScenario={handleScenario} />
      )}

      {activeTab === "EXPORTS" && selectedExperiment && (
        <ArtifactExportHub
          experimentId={selectedExperiment.experiment_id}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
