"use client";

import React, { useEffect, useState } from "react";
import {
  CalibrationHistoryItem,
  CalibrationProtocol,
  CalibrationReport,
  CalibrationSession,
  CalibrationTrial,
  CreateSubjectProfileRequest,
  PersonalizationConfig,
  PersonalizedExperimentResult,
  SubjectProfile,
} from "@neuromove/contracts";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  Crosshair,
  Clock,
  Play,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  History,
} from "lucide-react";

import { SubjectProfileSelector } from "@/components/calibration/SubjectProfileSelector";
import { ProtocolConfigurator } from "@/components/calibration/ProtocolConfigurator";
import { VisualCuePresenter } from "@/components/calibration/VisualCuePresenter";
import { LiveTrialTable } from "@/components/calibration/LiveTrialTable";
import { QualityPanel } from "@/components/calibration/QualityPanel";
import { PersonalizationPanel } from "@/components/calibration/PersonalizationPanel";
import { CalibrationHistoryViewer } from "@/components/calibration/CalibrationHistoryViewer";
import { CalibrationReportViewer } from "@/components/calibration/CalibrationReportViewer";

import {
  abortCalibrationSession,
  advanceSimulationTrial,
  createSubjectProfile,
  fetchCalibrationProtocols,
  fetchCalibrationReport,
  fetchCalibrationTrials,
  fetchSubjectCalibrationHistory,
  fetchSubjectProfiles,
  pauseCalibrationSession,

  resumeCalibrationSession,
  runPersonalization,
  startCalibrationSession,
} from "@/lib/api-client";

export default function CalibrationPage() {
  const { operatingMode } = useMode();
  const [activeTab, setActiveTab] = useState<"session" | "qc" | "personalization" | "history">("session");

  // State
  const [profiles, setProfiles] = useState<SubjectProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SubjectProfile | null>(null);
  const [protocol, setProtocol] = useState<CalibrationProtocol | null>(null);
  const [session, setSession] = useState<CalibrationSession | null>(null);
  const [trials, setTrials] = useState<CalibrationTrial[]>([]);
  const [experimentResult, setExperimentResult] = useState<PersonalizedExperimentResult | null>(null);
  const [history, setHistory] = useState<CalibrationHistoryItem[]>([]);
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  // Load initial profiles & default protocol
  useEffect(() => {
    async function loadInitial() {
      try {
        const [profList, protoList] = await Promise.all([
          fetchSubjectProfiles(),
          fetchCalibrationProtocols(),
        ]);
        setProfiles(profList);
        if (profList.length > 0) setSelectedProfile(profList[0]);
        if (protoList.length > 0) setProtocol(protoList[0]);
      } catch (err) {
        console.error("Failed to load calibration initial data:", err);
      }
    }
    loadInitial();
  }, []);

  // Load history when profile changes
  useEffect(() => {
    if (!selectedProfile) return;
    fetchSubjectCalibrationHistory(selectedProfile.subject_id)
      .then(setHistory)
      .catch((err) => console.error("Failed to load subject history:", err));
  }, [selectedProfile]);

  // Actions
  const handleCreateProfile = async (req: CreateSubjectProfileRequest) => {
    const created = await createSubjectProfile(req);
    setProfiles((prev) => [created, ...prev]);
    setSelectedProfile(created);
  };

  const handleStartSession = async () => {
    if (!selectedProfile || !protocol) return;
    setIsLoading(true);
    try {
      const res = await startCalibrationSession({
        profile_id: selectedProfile.profile_id,
        subject_id: selectedProfile.subject_id,
        protocol: protocol,
        source_mode: "SIMULATION",
      });
      setSession(res.session);
      setTrials(res.trials);
      setExperimentResult(null);
    } catch (err) {
      console.error("Failed to start calibration session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!session) return;
    try {
      const updated = await pauseCalibrationSession(session.calibration_id);
      setSession(updated);
    } catch (err) {
      console.error("Failed to pause:", err);
    }
  };

  const handleResume = async () => {
    if (!session) return;
    try {
      const updated = await resumeCalibrationSession(session.calibration_id);
      setSession(updated);
    } catch (err) {
      console.error("Failed to resume:", err);
    }
  };

  const handleAbort = async () => {
    if (!session) return;
    try {
      const updated = await abortCalibrationSession(session.calibration_id);
      setSession(updated);
      const updatedTrials = await fetchCalibrationTrials(session.calibration_id);
      setTrials(updatedTrials);
    } catch (err) {
      console.error("Failed to abort:", err);
    }
  };

  const handleAdvanceSimulation = async () => {
    if (!session) return;
    try {
      const updated = await advanceSimulationTrial(session.calibration_id);
      setSession(updated);
      const updatedTrials = await fetchCalibrationTrials(session.calibration_id);
      setTrials(updatedTrials);

      // If completed, load report & refresh history
      if (updated.status === "QUALITY_REVIEW" || updated.status === "READY") {
        const rpt = await fetchCalibrationReport(updated.calibration_id);
        setReport(rpt);
        if (selectedProfile) {
          const hist = await fetchSubjectCalibrationHistory(selectedProfile.subject_id);
          setHistory(hist);
        }
      }
    } catch (err) {
      console.error("Failed to advance simulation step:", err);
    }
  };

  const handleRunPersonalization = async (config: PersonalizationConfig) => {
    setIsPersonalizing(true);
    try {
      const result = await runPersonalization(config);
      setExperimentResult(result);
      if (selectedProfile) {
        const hist = await fetchSubjectCalibrationHistory(selectedProfile.subject_id);
        setHistory(hist);
      }
    } catch (err) {
      console.error("Personalization failed:", err);
    } finally {
      setIsPersonalizing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Personalization Engine (Phase 13)"
        title="Personalized Motor-Imagery Calibration"
        description="Standardized Graz visual cue presentation, research trial quality control, and subject-specific decoder adaptation."
        mode={operatingMode}
      />

      {/* Top Level Diagnostic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Participant Subject"
          value={selectedProfile?.subject_id || "sub-001"}
          subtitle={selectedProfile?.display_name || "Standard Profile"}
          variant="brand"
          icon={<Crosshair className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Calibration Paradigm"
          value="Graz MI V1"
          subtitle={`${protocol?.trials_per_class || 10} trials/class • Seed ${protocol?.random_state || 42}`}
          icon={<Clock className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Trial Data Quality"
          value={session ? `${session.valid_trial_count}/${session.trial_count}` : "0/0"}
          subtitle={session?.quality_summary?.is_sufficient ? "Sufficiency Met" : "Pending Session"}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Acquisition Mode"
          value="SIMULATION"
          subtitle="Synthetic Sensorimotor ERD"
          variant="accent"
          source="SYNTHETIC GENERATOR"
        />
      </div>

      {/* Tabbed Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("session")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "session"
              ? "border-blue-600 text-blue-600 bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Play className="w-3.5 h-3.5" /> 1. Calibration Session & Cues
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qc")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "qc"
              ? "border-blue-600 text-blue-600 bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> 2. Trial QC & Sufficiency
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("personalization")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "personalization"
              ? "border-blue-600 text-blue-600 bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> 3. Personalized Model & Benchmark
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600 bg-blue-50/20"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <History className="w-3.5 h-3.5" /> 4. Version History & Reports
        </button>
      </div>

      {/* Tab 1: Calibration Session & Cues */}
      {activeTab === "session" && (
        <div className="space-y-6">
          <SubjectProfileSelector
            profiles={profiles}
            selectedProfileId={selectedProfile?.profile_id || null}
            onSelectProfile={setSelectedProfile}
            onCreateProfile={handleCreateProfile}
            disabled={session?.status === "IN_PROGRESS"}
          />

          {protocol && (
            <ProtocolConfigurator
              protocol={protocol}
              onChange={setProtocol}
              disabled={session?.status === "IN_PROGRESS"}
            />
          )}

          {(!session || session.status === "PLANNED") && (
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between flex-wrap gap-3">
              <Notice variant="info" className="py-1 flex-1 max-w-xl">
                Ready to initialize protocol for <strong>{selectedProfile?.subject_id}</strong> in <strong>SIMULATION mode</strong>.
              </Notice>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartSession}
                loading={isLoading}
                icon={<Play className="w-4 h-4" />}
              >
                Arm & Start Calibration
              </Button>
            </div>
          )}

          <VisualCuePresenter
            session={session}
            trials={trials}
            onPause={handlePause}
            onResume={handleResume}
            onAbort={handleAbort}
            onAdvanceStep={handleAdvanceSimulation}
            isSimulating={true}
          />
        </div>
      )}

      {/* Tab 2: Trial QC & Sufficiency */}
      {activeTab === "qc" && (
        <div className="space-y-6">
          <QualityPanel summary={session?.quality_summary || null} />
          <LiveTrialTable trials={trials} activeTrialIndex={session?.active_trial_index} />
        </div>
      )}

      {/* Tab 3: Personalized Modeling & Benchmark */}
      {activeTab === "personalization" && (
        <div className="space-y-6">
          <PersonalizationPanel
            session={session}
            onRunPersonalization={handleRunPersonalization}
            experimentResult={experimentResult}
            isPersonalizing={isPersonalizing}
          />
        </div>
      )}

      {/* Tab 4: Version History & Reports */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <CalibrationHistoryViewer history={history} selectedCalibrationId={session?.calibration_id} />
          <CalibrationReportViewer report={report} />
        </div>
      )}

      {/* Scientific Guidance Footnote */}
      <InsightCard
        title="Scientific Invariant: Leakage-Safe Subject Adaptation"
        variant="accent"
        icon={<Sparkles className="w-5 h-5 text-teal-600" />}
      >
        Personalized Common Spatial Pattern (CSP) spatial filters, feature scalers, and classifier parameters are fitted strictly on the calibration training block. Generalization is evaluated on untouched held-out trials and benchmarked against the generic baseline model.
      </InsightCard>
    </div>
  );
}
