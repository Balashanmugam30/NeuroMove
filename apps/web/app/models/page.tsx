"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightCard } from "@/components/ui/InsightCard";
import {
  ClassificationTask,
  DecoderPipelineConfig,
  BenchmarkPreview,
  ModelManifest,
  ModelSummary,
  EpochSummary,
} from "@neuromove/contracts";
import {
  fetchClassificationTasks,
  previewDecoderBenchmark,
  runDecoderBenchmark,
  fetchDecoderModels,
  fetchDecoderModelManifest,
  fetchEpochSets,
} from "@/lib/api-client";
import { TaskSelector } from "@/components/models/TaskSelector";
import { PipelineConfigurator } from "@/components/models/PipelineConfigurator";
import { BenchmarkRunner } from "@/components/models/BenchmarkRunner";
import { MetricsCard } from "@/components/models/MetricsCard";
import { ConfusionMatrixViewer } from "@/components/models/ConfusionMatrixViewer";
import { PerSubjectBarChart } from "@/components/models/PerSubjectBarChart";
import { CSPPatternViewer } from "@/components/models/CSPPatternViewer";
import { ModelRegistryTable } from "@/components/models/ModelRegistryTable";
import { ModelDetailDrawer } from "@/components/models/ModelDetailDrawer";
import {
  Sparkles,
  RotateCcw,
} from "lucide-react";


const DEFAULT_TASKS: ClassificationTask[] = [
  {
    task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    task_name: "Left Hand vs Right Hand Motor Imagery",
    description: "Binary sensorimotor rhythm decoding for contralateral motor cortex activation (C3 vs C4).",
    class_labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
    label_mapping: { LEFT_IMAGERY: 0, RIGHT_IMAGERY: 1 },
    version: "1.0.0",
  },
  {
    task_id: "FEET_VS_FISTS_V1",
    task_name: "Feet vs Bilateral Fists Motor Imagery",
    description: "Binary motor imagery task for sagittal (Cz) vs lateral sensorimotor rhythm modulation.",
    class_labels: ["FEET_IMAGERY", "BOTH_FISTS_IMAGERY"],
    label_mapping: { FEET_IMAGERY: 0, BOTH_FISTS_IMAGERY: 1 },
    version: "1.0.0",
  },
];

export default function ModelsClassicalPage() {
  const { operatingMode } = useMode();

  const [tasks, setTasks] = useState<ClassificationTask[]>(DEFAULT_TASKS);
  const [epochSets, setEpochSets] = useState<EpochSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [activeManifest, setActiveManifest] = useState<ModelManifest | null>(null);
  const [selectedDrawerManifest, setSelectedDrawerManifest] =
    useState<ModelManifest | null>(null);


  const [pipelineConfig, setPipelineConfig] = useState<DecoderPipelineConfig>({
    pipeline_version: "DECODER_PIPELINE_V1",
    task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    epoch_set_id: "",
    channels: [],
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
    classifier_config: {
      classifier_id: "lda_baseline",
      classifier_type: "LDA",
      solver: "svd",
      shrinkage: null,
      kernel: "linear",
      c_param: 1.0,
      gamma: "scale",
      dummy_strategy: "prior",
      random_state: 42,
      version: "1.0.0",
    },
    evaluation_protocol: "LEAVE_ONE_SUBJECT_OUT",
    evaluation_mode: "INTER_SUBJECT",
    n_splits: 5,
    scale_features: false,
    random_state: 42,
  });

  const [preview, setPreview] = useState<BenchmarkPreview | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initial load of tasks, epoch sets, and models
  const loadInitialData = useCallback(async () => {
    try {
      const [fetchedTasks, fetchedEpochs, fetchedModels] = await Promise.all([
        fetchClassificationTasks().catch(() => []),
        fetchEpochSets().catch(() => []),
        fetchDecoderModels().catch(() => []),
      ]);

      setTasks(fetchedTasks);
      setEpochSets(fetchedEpochs);
      setModels(fetchedModels);

      if (fetchedTasks.length > 0 && fetchedEpochs.length > 0) {
        setPipelineConfig((prev) => ({
          ...prev,
          task_id: prev.task_id || fetchedTasks[0].task_id,
          epoch_set_id: prev.epoch_set_id || fetchedEpochs[0].epoch_set_id,
        }));
      }

      if (fetchedModels.length > 0) {
        // Load latest manifest
        const latest = await fetchDecoderModelManifest(fetchedModels[0].model_id).catch(() => null);
        if (latest) setActiveManifest(latest);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize classical decoding workspace.");
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Update validation preview on config changes
  useEffect(() => {
    if (!pipelineConfig.task_id || !pipelineConfig.epoch_set_id) return;

    let isMounted = true;
    previewDecoderBenchmark(pipelineConfig)
      .then((res) => {
        if (isMounted) setPreview(res);
      })
      .catch((err) => {
        if (isMounted) {
          setPreview({
            valid: false,
            task_id: pipelineConfig.task_id,
            epoch_set_id: pipelineConfig.epoch_set_id,
            total_epochs: 0,
            eligible_epochs: 0,
            excluded_epochs: 0,
            class_distribution: {},
            subjects_found: [],
            subject_count: 0,
            channels: [],
            sampling_rate_hz: 0,
            protocol: pipelineConfig.evaluation_protocol,
            expected_folds: 0,
            warnings: [],
            errors: [err.message || "Preview validation failed."],
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pipelineConfig]);

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const manifest = await runDecoderBenchmark(pipelineConfig);
      setActiveManifest(manifest);

      // Refresh registered models
      const updatedModels = await fetchDecoderModels().catch(() => []);
      setModels(updatedModels);
    } catch (err: any) {
      setErrorMsg(err.message || "Decoding benchmark failed.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSelectModel = async (modelId: string) => {
    try {
      const manifest = await fetchDecoderModelManifest(modelId);
      setSelectedDrawerManifest(manifest);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to fetch manifest for ${modelId}.`);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="BCI Pipeline"
        title="CSP Spatial Filtering & Classical Decoders"
        description="Leakage-safe supervised motor-imagery decoding with Common Spatial Patterns (CSP), Linear Discriminant Analysis (LDA), and Support Vector Machines (SVM)."
        mode={operatingMode}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadInitialData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh Registry</span>
            </button>
          </div>
        }
      />

      {/* Global error banner if present */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-bold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Classification Task */}
      <TaskSelector
        tasks={tasks}
        selectedTaskId={pipelineConfig.task_id}
        onSelectTask={(taskId) =>
          setPipelineConfig((prev) => ({ ...prev, task_id: taskId }))
        }
        disabled={isRunning}
      />

      {/* Step 2: Pipeline Hyperparameters */}
      <PipelineConfigurator
        config={pipelineConfig}
        onChange={setPipelineConfig}
        availableEpochSets={epochSets.map((e) => ({
          epoch_set_id: e.epoch_set_id,
          total_events: e.total_events,
          source_kind: e.source_kind,
        }))}
        disabled={isRunning}
      />

      {/* Step 3: Validation & Execution */}
      <BenchmarkRunner
        preview={preview}
        isRunning={isRunning}
        onRunBenchmark={handleRunBenchmark}
        disabled={epochSets.length === 0}
      />

      {/* Results Section if an active benchmark manifest exists */}
      {activeManifest && (
        <div className="space-y-6 pt-2">
          {/* Headline Metrics */}
          <MetricsCard
            metrics={activeManifest.metrics}
            taskName={activeManifest.task.task_name}
            classifierName={`${activeManifest.classifier_config.classifier_type} (${activeManifest.csp_config.n_components} CSP)`}
          />

          {/* Research Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfusionMatrixViewer
              data={activeManifest.metrics.confusion_matrix}
              title="Aggregate Cross-Validation Confusion Matrix"
            />
            <PerSubjectBarChart
              data={activeManifest.metrics.per_subject_metrics}
              chanceLevel={activeManifest.metrics.chance_level}
            />
          </div>

          {/* CSP Patterns */}
          <CSPPatternViewer patterns={activeManifest.csp_patterns || null} />
        </div>
      )}

      {/* Step 4: Model Registry Table */}
      <ModelRegistryTable
        models={models}
        onSelectModel={handleSelectModel}
        selectedModelId={activeManifest?.model_id}
      />

      {/* Provenance & Scientific Invariant Insight */}
      <InsightCard
        title="Scientific Invariant: Zero Cross-Validation Data Leakage"
        variant="brand"
        icon={<Sparkles className="w-5 h-5 text-blue-600" />}
      >
        In strict adherence to BCI research standards, CSP spatial covariance matrices and spatial filters are fitted strictly on the training fold of each cross-validation partition ($train\_subjects \cap test\_subjects = \emptyset$). Test epochs remain completely unseen until inference.
      </InsightCard>

      {/* Detailed Provenance Drawer */}
      <ModelDetailDrawer
        manifest={selectedDrawerManifest}
        onClose={() => setSelectedDrawerManifest(null)}
      />
    </div>
  );
}
