"use client";

import React, { useState } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { Button } from "@/components/ui/Button";
import { Input, Select, SegmentedControl } from "@/components/ui/FormControls";
import { Notice } from "@/components/ui/Notice";
import { Crosshair, Clock, Play, Sparkles, CheckCircle2 } from "lucide-react";

export default function CalibrationPage() {
  const { operatingMode } = useMode();
  const [paradigm, setParadigm] = useState<string>("GRAZ");
  const [trialsCount, setTrialsCount] = useState<string>("20");
  const [subjectLabel, setSubjectLabel] = useState<string>("Subject_001");
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  const handleStart = () => {
    setIsCalibrating(true);
    setTimeout(() => setIsCalibrating(false), 3000);
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="BCI Pipeline"
        title="Calibration & Visual Cue Protocol"
        description="Standardized Graz visual cue paradigm presentation for subject sensorimotor rhythm baseline adaptation."
        mode={operatingMode}
      />

      {/* Protocol Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Paradigm Protocol"
          value="Graz MI"
          subtitle="Left/Right Hand Visual Cue"
          variant="brand"
          icon={<Crosshair className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Trial Duration"
          value="7.25s"
          subtitle="Fixation -> Cue -> Dwell"
          icon={<Clock className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Electrode Montage"
          value="3-Channel"
          subtitle="C3, Cz, C4 (10-20 system)"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Acquisition Mode"
          value="SIMULATED"
          subtitle="Deterministic Seed 42"
          variant="accent"
          source="SYNTHETIC GENERATOR"
        />
      </div>

      {/* Graz Paradigm Visual Timeline */}
      <SectionCard
        title="Graz Motor Imagery Trial Structure"
        description="Sequential temporal phases of an individual calibration trial"
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs mt-1">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>1. Fixation Cross</span>
              <span className="font-mono text-2xs text-slate-500">t = 0.0–2.0s</span>
            </div>
            <p className="text-2xs text-slate-500 font-normal">
              Visual center crosshair presentation. Subject establishes baseline resting attention.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
            <div className="flex items-center justify-between font-bold text-blue-950">
              <span>2. Visual Cue Arrow</span>
              <span className="font-mono text-2xs text-blue-700">t = 2.0–3.25s</span>
            </div>
            <p className="text-2xs text-blue-800 font-normal">
              Directional cue presentation (LEFT hand or RIGHT hand arrow trigger).
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 space-y-1">
            <div className="flex items-center justify-between font-bold text-teal-950">
              <span>3. Motor Imagery</span>
              <span className="font-mono text-2xs text-teal-700">t = 3.25–7.25s</span>
            </div>
            <p className="text-2xs text-teal-800 font-normal">
              Continuous kinesthetic motor imagery execution. ERD desynchronization extracted.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>4. Inter-Trial Rest</span>
              <span className="font-mono text-2xs text-slate-500">t = 7.25–9.0s</span>
            </div>
            <p className="text-2xs text-slate-500 font-normal">
              Short randomized break interval to prevent subject cognitive fatigue.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Protocol Configuration Form */}
      <SectionCard
        title="Calibration Session Protocol Settings"
        description="Configure participant identifiers, paradigm parameters, and trial sequence quotas"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Participant Subject ID"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
            helperText="Pseudonymous subject identifier"
          />

          <Select
            label="Trial Sequence Quota"
            value={trialsCount}
            onChange={(e) => setTrialsCount(e.target.value)}
            helperText="Balanced 50/50 left and right cues"
            options={[
              { value: "10", label: "10 Trials (Rapid Benchmark)" },
              { value: "20", label: "20 Trials (Standard Baseline)" },
              { value: "40", label: "40 Trials (High Precision)" },
            ]}
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Cue Display Mode
            </label>
            <div className="pt-0.5">
              <SegmentedControl
                value={paradigm}
                onChange={setParadigm}
                options={[
                  { value: "GRAZ", label: "Graz Visual Arrow" },
                  { value: "COLOR", label: "Color Flash" },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <Notice variant="info" className="py-2 flex-1 max-w-xl">
            Protocol calibration runs in <strong>SIMULATION mode</strong>. Canonical Trial and Session envelopes will be recorded into the core event bus.
          </Notice>

          <Button
            variant="primary"
            size="md"
            onClick={handleStart}
            loading={isCalibrating}
            icon={<Play className="w-4 h-4" />}
          >
            {isCalibrating ? "Executing Protocol..." : "Arm Calibration Protocol"}
          </Button>
        </div>
      </SectionCard>

      {/* Scientific Guidance Callout */}
      <InsightCard
        title="Scientific Context: Common Spatial Patterns (CSP) Calibration"
        variant="accent"
        icon={<Sparkles className="w-5 h-5 text-teal-600" />}
      >
        Calibration data is used to compute spatial covariance matrices R(left) and R(right). Maximizing the eigenvalue variance ratio allows CSP filters to project multi-channel electrophysiology into linearly separable feature spaces.
      </InsightCard>
    </div>
  );
}
