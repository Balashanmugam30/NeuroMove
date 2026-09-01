# NeuroMove Public EEG Dataset Ingestion Architecture

## 1. Overview & Research Mission
The NeuroMove dataset ingestion layer provides a reproducible, offline-ready framework for importing, normalizing, verifying, and slicing external electrophysiological recordings.

In Phase 08, the primary integrated benchmark dataset is the **PhysioNet EEG Motor Movement/Imagery Dataset** (EEGBCI, Schalk et al. 2004, Goldberger et al. 2000).

```
                        PUBLIC DATASET PROVIDER
                     (PhysioNet / MNE-Python / EDF)
                                   │
                                   ▼
                       MNE-Python Loader & Parser
                      (64 Channels, 10-10, 160 Hz)
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
        Metadata Normalizer                  Signal & Event Extractor
   (Subject / Run / Task Mapping)         (T0: Rest, T1: Left, T2: Right)
                │                                     │
                ▼                                     ▼
      SQLite Database (v002)                Managed Local Storage
   (`datasets`, `dataset_recordings`)      (`data/cache/`, `data/fixtures/`)
                │                                     │
                └──────────────────┬──────────────────┘
                                   │
                                   ▼
                         FastAPI REST Services
                         `/api/datasets/...`
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      Frontend Dataset Workspace                 EEG Laboratory
         `/research/datasets`                  `/eeg?mode=REPLAY`
```

---

## 2. Canonical Contracts & Schema Versioning
All dataset entities are strictly governed by cross-language Zod contracts (`@neuromove/contracts`) and Pydantic domain models (`neuromove.datasets.models`):

- **DatasetDefinition**: Canonical dataset catalog registration, license, citation, and cache status.
- **DatasetSubject**: Participant metadata (S001–S109) with 14 available experimental runs.
- **DatasetRecording**: Individual recording metadata, 64-channel topology, 160 Hz sampling rate, 125s duration, and SHA-256 checksum.
- **DatasetEvent**: Normalized motor-imagery and execution triggers mapped to canonical `NeuroMoveEventType` (`LEFT_IMAGERY`, `RIGHT_IMAGERY`, `REST_BASELINE`, etc.).
- **DatasetManifest**: Complete reproducibility manifest capturing loader versions, checksums, and source URLs.
- **IngestionQualityReport**: Scientific data-quality metrics and validation counts.

---

## 3. PhysioNet EEGBCI Protocol Mapping
PhysioNet EEGBCI recordings comprise 14 runs per subject:
- **Runs 1–2**: Baseline rest (Eyes open / closed).
- **Runs 3, 7, 11**: Motor execution (Left vs Right fist).
- **Runs 4, 8, 12**: Motor imagery (Left vs Right fist: T1=Left, T2=Right).
- **Runs 5, 9, 13**: Motor execution (Both fists vs Feet).
- **Runs 6, 10, 14**: Motor imagery (Both fists vs Feet: T1=Both fists, T2=Feet).

---

## 4. Scientific Honesty & Traceability
1. **Explicit Mode**: Replayed data is always labeled `MODE: REPLAY` and `SOURCE: RECORDED EEG`.
2. **Attribution**: Transparently attributes PhysioNet and original authors.
3. **No False Claims**: Never claims recorded public data is live user EEG.
