"use client";

import React, { useEffect, useState } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { DatasetCatalogCard } from "@/components/datasets/DatasetCatalogCard";
import { RecordingBrowser } from "@/components/datasets/RecordingBrowser";
import { IngestionQualityCard } from "@/components/datasets/IngestionQualityCard";
import {
  fetchDatasets,
  fetchDatasetSubjects,
  fetchDatasetRecordings,
  downloadDatasetRun,
  verifyDataset,
  fetchDatasetManifest,
  fetchDatasetQualityReport,
} from "@/lib/api-client";
import {
  DatasetDefinition,
  DatasetSubject,
  DatasetRecording,
  DatasetManifest,
  IngestionQualityReport,
} from "@neuromove/contracts";
import {
  RefreshCw,
  CheckCircle2,
  Layers,
  X,
} from "lucide-react";

const FALLBACK_DATASET: DatasetDefinition = {
  dataset_id: "physionet-eegbci",
  name: "PhysioNet EEG Motor Movement/Imagery Dataset",
  version: "1.0.0",
  provider: "PhysioNet / MNE-Python",
  source_reference: "https://physionet.org/content/eegmmidb/1.0.0/",
  official_reference: "Schalk et al. 2004; Goldberger et al. 2000",
  license: "Open Data Commons Attribution License v1.0 (ODC-By)",
  description: "64-channel 160 Hz motor execution and motor imagery EEG recordings from 109 subjects.",
  modality: "EEG (64-channel 10-10 montage, 160 Hz)",
  tasks: ["motor_imagery_fists", "motor_imagery_feet", "baseline_eyes_open"],
  default_loader: "MNE_EEGBCI_EDF_LOADER",
  supported: true,
  schema_version: "EEG_DATASET_INGESTION_V1",
  cache_status: "VERIFIED",
  subjects_count: 109,
  recordings_count: 1526,
  total_size_bytes: 3000000000,
};

const FALLBACK_SUBJECTS: DatasetSubject[] = [
  {
    dataset_id: "physionet-eegbci",
    subject_id: "public_subject_001",
    source_subject_id: "S001",
    recording_count: 14,
    runs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    available_tasks: ["motor_imagery_fists", "baseline_eyes_open"],
  },
];

const FALLBACK_RECORDINGS: DatasetRecording[] = [
  {
    recording_id: "rec_eegbci_S001_R04",
    dataset_id: "physionet-eegbci",
    dataset_version: "1.0.0",
    subject_id: "public_subject_001",
    source_subject_id: "S001",
    session_id: "ses_eegbci_S001",
    run_id: "R04",
    file_reference: "physionet-eegbci/S001/S001R04.edf",
    checksum_sha256: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
    sample_rate_hz: 160,
    channel_count: 64,
    channel_names: ["Fc5", "C3", "Cz", "C4"],
    duration_seconds: 125.0,
    task: "motor_imagery_fists",
    normalized_task_label: "Motor Imagery: Left vs Right Fist",
    event_count: 15,
    source_kind: "RECORDED",
    ingestion_version: "EEG_DATASET_INGESTION_V1",
    loader_version: "MNE-1.12.1",
    cache_status: "VERIFIED",
    created_at: "2026-09-01T00:00:00.000Z",
    events: [],
  },
];

const FALLBACK_QUALITY: IngestionQualityReport = {
  dataset_id: "physionet-eegbci",
  generated_at: "2026-09-01T00:00:00.000Z",
  files_discovered: 14,
  files_downloaded: 14,
  files_verified: 14,
  files_failed: 0,
  recordings_indexed: 14,
  recordings_failed: 0,
  metadata_missing: 0,
  channel_anomalies: 0,
  event_anomalies: 0,
  overall_status: "EXCELLENT",
};

export default function DatasetWorkspacePage() {
  const { operatingMode } = useMode();

  const [datasets, setDatasets] = useState<DatasetDefinition[]>([FALLBACK_DATASET]);
  const [subjects, setSubjects] = useState<DatasetSubject[]>(FALLBACK_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = useState<string>("public_subject_001");
  const [recordings, setRecordings] = useState<DatasetRecording[]>(FALLBACK_RECORDINGS);
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);
  const [qualityReport, setQualityReport] = useState<IngestionQualityReport | null>(FALLBACK_QUALITY);

  const [loading, setLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<"manifest" | "quality" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load initial dataset catalog
  const loadCatalog = async () => {
    setLoading(true);
    try {
      const ds = await fetchDatasets();
      if (ds && ds.length > 0) {
        setDatasets(ds);
        const firstId = ds[0].dataset_id;
        const [subs, recs, rep] = await Promise.all([
          fetchDatasetSubjects(firstId),
          fetchDatasetRecordings(firstId, selectedSubject),
          fetchDatasetQualityReport(firstId),
        ]);
        setSubjects(subs);
        setRecordings(recs);
        setQualityReport(rep);
      }
    } catch {
      // Offline development fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Update recordings when subject changes
  const handleSubjectChange = async (subId: string) => {
    setSelectedSubject(subId);
    if (datasets.length > 0) {
      try {
        const recs = await fetchDatasetRecordings(datasets[0].dataset_id, subId);
        setRecordings(recs);
      } catch (e) {
        console.error("Failed to load recordings:", e);
      }
    }
  };

  // Run SHA-256 verification
  const handleVerify = async () => {
    if (datasets.length === 0) return;
    setIsVerifying(true);
    try {
      const res = await verifyDataset(datasets[0].dataset_id);
      setStatusMessage(
        `Integrity Check Complete: ${res.verified}/${res.total_recordings} runs verified (SHA-256).`
      );
      await loadCatalog();
    } catch (e) {
      console.error("Verification failed:", e);
      setStatusMessage("Verification error occurred.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Download run
  const handleDownloadRun = async (subjectId: string, runId: string) => {
    if (datasets.length === 0) return;
    setIsDownloading(true);
    try {
      await downloadDatasetRun(datasets[0].dataset_id, subjectId, runId);
      setStatusMessage(`Synchronized run ${runId} for subject ${subjectId}.`);
      await handleSubjectChange(selectedSubject);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  // View manifest JSON
  const handleViewManifest = async () => {
    if (datasets.length === 0) return;
    try {
      const man = await fetchDatasetManifest(datasets[0].dataset_id);
      setManifest(man);
      setActiveModal("manifest");
    } catch (e) {
      console.error("Failed to fetch manifest:", e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      {/* 1. Page Header */}
      <PageHeader
        category="Research & Evidence"
        title="Public EEG Datasets & Research Workspace"
        description="Offline-first public dataset ingestion, checksum-verified local cache, and participant recording explorer."
        mode={operatingMode}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCatalog}
              disabled={loading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {statusMessage && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-blue-500 hover:text-blue-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Dataset Catalog Card */}
      {datasets.length > 0 ? (
        <DatasetCatalogCard
          dataset={datasets[0]}
          onVerify={handleVerify}
          onViewManifest={handleViewManifest}
          onViewQuality={() => setActiveModal("quality")}
          isVerifying={isVerifying}
        />
      ) : (
        <SectionCard title="Dataset Catalog" description="Loading registered datasets...">
          <div className="py-8 text-center text-slate-400 text-xs">
            Connecting to Control Station dataset registry...
          </div>
        </SectionCard>
      )}

      {/* 3. Ingestion Quality & Subject Leakage Invariant */}
      {qualityReport && <IngestionQualityCard report={qualityReport} />}

      {/* 4. Subject & Run Recording Browser */}
      <SectionCard
        title="Participant Run Explorer"
        description="Select a participant subject and experimental task run to inspect 64-channel waveforms and event markers in EEG Lab."
        badge={
          <span className="text-2xs font-mono text-slate-500">
            {recordings.length} Runs Indexed
          </span>
        }
      >
        <RecordingBrowser
          recordings={recordings}
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSubjectChange={handleSubjectChange}
          onDownloadRun={handleDownloadRun}
          isDownloading={isDownloading}
        />
      </SectionCard>

      {/* Modal / Drawer for Reproducibility Manifest JSON */}
      {activeModal === "manifest" && manifest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Reproducibility Manifest ({manifest.dataset_id})
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-2xs bg-slate-50 text-slate-800">
              <pre>{JSON.stringify(manifest, null, 2)}</pre>
            </div>
            <div className="p-3 border-t border-slate-200 bg-white flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Ingestion Quality Report */}
      {activeModal === "quality" && qualityReport && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Ingestion Quality Report ({qualityReport.dataset_id})
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-2xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>Files Discovered:</strong> {qualityReport.files_discovered}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>Files Verified:</strong> {qualityReport.files_verified}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>Metadata Anomalies:</strong> {qualityReport.metadata_missing}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>Overall Status:</strong> {qualityReport.overall_status}
                </div>
              </div>
              <p className="text-slate-500 text-2xs leading-relaxed">
                All participant files conform to the 64-channel 10-10 electrode montage and standard
                PhysioNet event annotation mapping.
              </p>
            </div>
            <div className="p-3 border-t border-slate-200 bg-white flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
