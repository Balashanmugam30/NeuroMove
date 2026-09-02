"use client";

import React, { useEffect, useState } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductHealthHeader } from "@/components/product/ProductHealthHeader";
import { DemoScenarioSelector } from "@/components/product/DemoScenarioSelector";
import { DemoStepTimeline } from "@/components/product/DemoStepTimeline";
import { SafetyExplanationCard } from "@/components/product/SafetyExplanationCard";
import { DemoResultCard } from "@/components/product/DemoResultCard";
import { ProvenanceSummary } from "@/components/product/ProvenanceSummary";
import {
  fetchDemoScenarios,
  fetchProductStatus,
  fetchActiveDemoRun,
  startDemoScenario,
  advanceDemoStep,
  executeDemoScenario,
  fetchDemoResult,
  resetDemo,
} from "@/lib/api-client";
import {
  DemoScenario,
  DemoRun,
  DemoResult,
  SystemStatusSummary,
} from "@neuromove/contracts";

export default function DemoPage() {
  const { operatingMode } = useMode();
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("PRODUCT_A");
  const [activeRun, setActiveRun] = useState<DemoRun | null>(null);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [productStatus, setProductStatus] = useState<SystemStatusSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [scList, status, active] = await Promise.all([
        fetchDemoScenarios(),
        fetchProductStatus(),
        fetchActiveDemoRun(),
      ]);
      setScenarios(scList);
      setProductStatus(status);
      if (active) {
        setActiveRun(active);
        if (active.completed_at || active.is_blocked) {
          try {
            const res = await fetchDemoResult(active.run_id);
            setDemoResult(res);
          } catch {
            // Safe fallback
          }
        }
      }
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleRunFull = async (scenarioId: string) => {
    setLoading(true);
    try {
      const result = await executeDemoScenario(scenarioId);
      setDemoResult(result);
      const active = await fetchActiveDemoRun();
      setActiveRun(active);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleStartStepByStep = async (scenarioId: string) => {
    setLoading(true);
    setDemoResult(null);
    try {
      const run = await startDemoScenario(scenarioId);
      setActiveRun(run);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStep = async () => {
    if (!activeRun) return;
    setLoading(true);
    try {
      const updated = await advanceDemoStep(activeRun.run_id);
      setActiveRun(updated);
      if (updated.completed_at || updated.is_blocked || updated.current_step >= 9) {
        try {
          const res = await fetchDemoResult(updated.run_id);
          setDemoResult(res);
        } catch {
          // Fallback
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetDemo();
      setActiveRun(null);
      setDemoResult(null);
      const status = await fetchProductStatus();
      setProductStatus(status);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <PageHeader
        category="Product Release"
        title="Guided Demonstration & Golden Verification Scenarios"
        description="Deterministic, fail-closed end-to-end neurotechnology workflow demonstrating acquisition, decoding, confidence gating, safety arbitration, and HIL validation."
        mode={operatingMode}
      />

      {/* Global Product Health Header */}
      <ProductHealthHeader
        statusSummary={productStatus}
        onRefresh={loadInitialData}
        loading={loading}
      />

      {/* Scenario Selection Grid & Actions */}
      <DemoScenarioSelector
        scenarios={scenarios}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={setSelectedScenarioId}
        onRunFull={handleRunFull}
        onStartStepByStep={handleStartStepByStep}
        onAdvanceStep={handleAdvanceStep}
        onReset={handleReset}
        isRunActive={!!activeRun && !activeRun.completed_at && !activeRun.is_blocked}
        loading={loading}
      />

      {/* 9-Step Guided Timeline */}
      {activeRun && (
        <DemoStepTimeline
          steps={activeRun.steps}
          currentStep={activeRun.current_step}
          isBlocked={activeRun.is_blocked}
        />
      )}

      {/* Safety Explanation Card */}
      {activeRun && (
        <SafetyExplanationCard
          safetyVerdict={activeRun.safety_verdict}
          isBlocked={activeRun.is_blocked}
          blockReason={activeRun.block_reason}
          candidateIntent={activeRun.candidate_intent}
          confidenceScore={activeRun.confidence_score}
          explanationText={demoResult?.explanation_text}
        />
      )}

      {/* Final Demo Result Presentation Card */}
      {demoResult && <DemoResultCard result={demoResult} />}

      {/* Scientific Lineage & Cryptographic Provenance */}
      {demoResult?.provenance && (
        <ProvenanceSummary provenance={demoResult.provenance} />
      )}
    </div>
  );
}
