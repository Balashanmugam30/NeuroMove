# NeuroMove Dataset Provenance & Integrity Specification

## 1. SHA-256 Checksum Validation
Every ingested recording file is hashed with SHA-256 upon initial download or local discovery.
Checksums are stored in the SQLite database (`dataset_recordings` table) and exported in the reproducibility manifest (`DatasetManifest`).

Verification is executable via:
1. REST endpoint: `POST /api/datasets/{dataset_id}/verify`
2. Python CLI: `python -m neuromove.datasets.cli verify --dataset-id physionet-eegbci`
3. Frontend UI: `/research/datasets` "Verify Cache Checksums" button.

---

## 2. Subject Boundary Leakage Invariant
> **CRITICAL SCIENTIFIC INVARIANT**:
> Never perform random window-level train/test splits across the same participant.
> Subject (S001–S109) and session/run boundaries must be strictly preserved to prevent data leakage during subsequent classifier validation, cross-subject transfer learning, and model calibration phases.

---

## 3. Provenance Metadata Contract
Every analysis and sliced signal response emitted from public datasets contains complete provenance metadata:
```json
{
  "analysis_id": "anl_psd_a9f82d1c",
  "analysis_version": "EEG_ANALYSIS_V1",
  "source_kind": "RECORDED",
  "mode": "REPLAY",
  "dataset_id": "physionet-eegbci",
  "recording_id": "rec_eegbci_S001_R04",
  "sampling_rate_hz": 160,
  "engine": "MNE-Python 1.12.1"
}
```
