"use client";

import React, { useState } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InsightCard } from "@/components/ui/InsightCard";
import { Button } from "@/components/ui/Button";
import { BrainCircuit, Cpu, Sparkles, Download, CheckCircle2 } from "lucide-react";
import { ModelArtifact } from "@neuromove/contracts";

export default function ModelsPage() {
  const { operatingMode } = useMode();

  const [artifacts] = useState<ModelArtifact[]>([
    {
      model_id: "mdl_baseline_csp_lda_v1",
      model_type: "CSP_LDA",
      version: "1.0.0",
      created_at: "2026-09-01T00:00:00.000Z",
      training_dataset: "synthetic_sim_v1",
      feature_pipeline: "Butterworth_8_30Hz_CAR_CSP",
      classifier: "Shrinkage_Regularized_LDA",
      metrics_reference: {
        accuracy: 0.88,
        cohen_kappa: 0.76,
        latency_ms: 12.4,
      },
      artifact_path: "artifacts/models/baseline_csp_lda_v1.pkl",
      status: "ready",
    },
    {
      model_id: "mdl_eegnet_smr_candidate",
      model_type: "EEGNet_Compact",
      version: "0.2.0",
      created_at: "2026-08-31T00:00:00.000Z",
      training_dataset: "synthetic_sim_v1",
      feature_pipeline: "TemporalSpatialConv2D",
      classifier: "SoftmaxCrossEntropy",
      metrics_reference: {
        accuracy: 0.91,
        cohen_kappa: 0.82,
        latency_ms: 18.2,
      },
      artifact_path: "artifacts/models/eegnet_v0.2.0.onnx",
      status: "ready",
    },
  ]);

  const columns: Column<ModelArtifact>[] = [
    {
      key: "model_id",
      header: "Model Artifact ID",
      render: (item) => (
        <span className="font-mono text-2xs font-bold text-blue-700">
          {item.model_id}
        </span>
      ),
    },
    {
      key: "model_type",
      header: "Type",
      render: (item) => (
        <span className="font-semibold text-slate-800">{item.model_type}</span>
      ),
    },
    {
      key: "feature_pipeline",
      header: "DSP Feature Pipeline",
      render: (item) => (
        <span className="font-mono text-2xs text-slate-600">
          {item.feature_pipeline}
        </span>
      ),
    },
    {
      key: "classifier",
      header: "Classifier",
      render: (item) => (
        <span className="text-2xs text-slate-700 font-medium">
          {item.classifier}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="BCI Pipeline"
        title="AI Models & Spatial Filter Registry"
        description="Filter Bank Common Spatial Pattern (CSP) decompositions, Regularized LDA hyperplanes, and model artifact evaluation."
        mode={operatingMode}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          >
            Export Weights
          </Button>
        }
      />

      {/* Model Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Model"
          value="CSP_LDA"
          subtitle="Baseline v1.0.0 Active"
          variant="brand"
          icon={<BrainCircuit className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Spatial Filters"
          value="6 Components"
          subtitle="3 Left-hand, 3 Right-hand"
          icon={<Cpu className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Inference Latency"
          value="12.4 ms"
          subtitle="Local single-batch inference"
          variant="safe"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Training Source"
          value="Synthetic Sim"
          subtitle="Seed 42 Calibration Set"
          variant="accent"
          source="MODEL REGISTRY"
        />
      </div>

      {/* Model Artifacts Table */}
      <SectionCard
        title="Registered Model Artifacts"
        description="Versioned classification pipelines and validated spatial projection weights"
      >
        <DataTable
          columns={columns}
          data={artifacts}
          keyExtractor={(item) => item.model_id}
        />
      </SectionCard>

      {/* Mathematical Pipeline Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Common Spatial Patterns (CSP) Matrix"
          description="Projection filter W derived from covariance matrix eigenvalues"
        >
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-2 text-slate-700">
            <div className="flex justify-between pb-1.5 border-b border-slate-200 text-2xs font-bold text-slate-500">
              <span>Channel</span>
              <span>Filter Component 1</span>
              <span>Filter Component 2</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-blue-700">C3</span>
              <span>+0.7241</span>
              <span>-0.1284</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">Cz</span>
              <span>-0.0892</span>
              <span>+0.0415</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-teal-700">C4</span>
              <span>-0.6819</span>
              <span>+0.7932</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Linear Discriminant Hyperplane"
          description="Decision boundary $w^T x + b = 0$ with Ledoit-Wolf covariance shrinkage"
        >
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between text-2xs pb-1.5 border-b border-slate-200">
              <span className="font-semibold text-slate-600">Decision Threshold:</span>
              <span className="font-mono font-bold text-slate-900">0.0000 (Symmetric)</span>
            </div>
            <div className="flex items-center justify-between text-2xs pb-1.5 border-b border-slate-200">
              <span className="font-semibold text-slate-600">Posterior Probability Gate:</span>
              <span className="font-mono font-bold text-emerald-700">&ge; 0.85 Confidence</span>
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="font-semibold text-slate-600">Regularization Parameter:</span>
              <span className="font-mono font-bold text-blue-700">&lambda; = 0.15 (Shrinkage)</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Scientific Guidance Callout */}
      <InsightCard
        title="Scientific Principle: Event-Related Desynchronization (ERD)"
        variant="brand"
        icon={<Sparkles className="w-5 h-5 text-blue-600" />}
      >
        During right-hand motor imagery, the left sensorimotor cortex exhibits μ-band power attenuation (C3 ERD), while the contralateral hemisphere remains in resting synchronization (C4 ERS). The CSP + LDA pipeline separates these spatial energy dynamics.
      </InsightCard>
    </div>
  );
}
