import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatasetCatalogCard } from "../components/datasets/DatasetCatalogCard";
import { RecordingBrowser } from "../components/datasets/RecordingBrowser";
import { IngestionQualityCard } from "../components/datasets/IngestionQualityCard";
import { DatasetDefinition, DatasetSubject, DatasetRecording } from "@neuromove/contracts";

const mockDataset: DatasetDefinition = {
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

const mockSubjects: DatasetSubject[] = [
  {
    dataset_id: "physionet-eegbci",
    subject_id: "public_subject_001",
    source_subject_id: "S001",
    recording_count: 14,
    runs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    available_tasks: ["motor_imagery_fists", "baseline_eyes_open"],
  },
];

const mockRecordings: DatasetRecording[] = [
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

describe("Phase 08 Public Dataset Ingestion & Workspace Components", () => {
  it("renders DatasetCatalogCard with official license, cache status, and citation", () => {
    render(<DatasetCatalogCard dataset={mockDataset} />);

    expect(
      screen.getByText("PhysioNet EEG Motor Movement/Imagery Dataset")
    ).toBeInTheDocument();
    expect(screen.getByText(/verified cache/i)).toBeInTheDocument();
    expect(screen.getByText("PhysioNet / MNE-Python")).toBeInTheDocument();
    expect(screen.getAllByText(/109 subjects/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Schalk et al. 2004/i)).toBeInTheDocument();
    expect(screen.getByText(/Open Data Commons/i)).toBeInTheDocument();
  });

  it("renders RecordingBrowser and filters recordings with Open in EEG Lab link", () => {
    const handleDownload = vi.fn();
    const handleSubjectChange = vi.fn();

    render(
      <RecordingBrowser
        recordings={mockRecordings}
        subjects={mockSubjects}
        selectedSubject="public_subject_001"
        onSubjectChange={handleSubjectChange}
        onDownloadRun={handleDownload}
      />
    );

    expect(screen.getByText("R04")).toBeInTheDocument();
    expect(screen.getByText("Motor Imagery: Left vs Right Fist")).toBeInTheDocument();
    expect(screen.getByText("160 Hz")).toBeInTheDocument();
    expect(screen.getByText("64 ch (10-10)")).toBeInTheDocument();
    expect(screen.getByText("Open in EEG Lab")).toBeInTheDocument();
  });

  it("renders IngestionQualityCard and displays Subject Boundary Leakage Invariant", () => {
    render(
      <IngestionQualityCard
        report={{
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
        }}
      />
    );

    expect(screen.getByText(/Research Validity: Strict Subject Boundary Invariant/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not perform random window-level train\/test splits/i)).toBeInTheDocument();
    expect(screen.getByText("100% SHA-256")).toBeInTheDocument();
  });
});
