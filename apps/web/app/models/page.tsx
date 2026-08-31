"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainCircuit, Cpu } from "lucide-react";

export default function ModelsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            BCI Models & CSP Spatial Filters
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Spatial pattern decompositions, shrinkage LDA classifiers, and
            cross-validation diagnostics.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Active Classifier"
          description="Loaded inference weights for real-time intent decoding"
        >
          <EmptyState
            title="Model Artifact Contracts Active"
            description="Canonical ModelArtifact and Prediction contracts defined. Training pipelines (CSP + LDA/SVM/EEGNet) will be implemented in dedicated model lab phases."
            icon={<BrainCircuit className="w-6 h-6 text-blue-600" />}
          />
        </SectionCard>

        <SectionCard
          title="Common Spatial Patterns (CSP)"
          description="Eigenvalue variance maximization between Left vs Right hand imagery"
        >
          <EmptyState
            title="Spatial Filters Uninitialized"
            description="Awaiting calibration dataset and covariance matrix estimation."
            icon={<Cpu className="w-6 h-6 text-teal-600" />}
          />
        </SectionCard>
      </div>
    </div>
  );
}
