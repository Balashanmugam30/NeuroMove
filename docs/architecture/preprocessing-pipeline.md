# Architecture Document: EEG Preprocessing & DSP Pipeline (`EEG_PREPROCESSING_V1`)

## 1. Overview & Purpose
NeuroMove provides a scientific, versioned, configurable, and strictly non-destructive electroencephalography (EEG) preprocessing and digital signal processing (DSP) pipeline. The pipeline transforms raw synthetic and recorded public EEG into clean, epoch-ready, and feature-ready representations suitable for subsequent motor-imagery classification (CSP, LDA, SVM, EEGNet) and offline research replay.

```
 RAW EEG SOURCE (Simulation 250 Hz or PhysioNet 160 Hz)
                         │
                         ▼
        Stage 1: VALIDATE (Sampling Rate & Bads)
                         │
                         ▼
        Stage 2: REFERENCE (Common Average or Scalp Montage)
                         │
                         ▼
        Stage 3: FILTER (Zero-Phase FIR Band-Pass 0.5–40 Hz)
                         │
                         ▼
        Stage 4: NOTCH (Line-Noise 50/60 Hz Suppression)
                         │
                         ▼
        Stage 5: RESAMPLE (Polyphase Anti-Aliasing)
                         │
                         ▼
        Stage 6: ARTIFACT (Optional FastICA Component Clean)
                         │
                         ▼
        Stage 7: FINAL_VALIDATE (NaN/Inf & Integrity Scan)
                         │
                         ▼
 PREPROCESSED DERIVED ARTIFACT (`data/processed/pre_<hash>.fif`)
```

---

## 2. Pipeline Stages & Execution Flow

| Stage | Identifier | MNE / Scientific Implementation | Default Behavior |
| :--- | :--- | :--- | :--- |
| **1. Source Validation** | `VALIDATE` | Verify channels, sample rate, and mark bad electrodes | `bads = []` |
| **2. Spatial Reference** | `REFERENCE` | `mne.set_eeg_reference(ref_channels='average')` | Common Average Reference |
| **3. Band-Pass Filter** | `FILTER` | `raw.filter(l_freq=0.5, h_freq=40.0, method='fir', phase='zero')` | 0.5 – 40.0 Hz Zero-Phase FIR |
| **4. Line-Noise Notch** | `NOTCH` | `raw.notch_filter(freqs=[50.0], method='fir', phase='zero')` | Skipped if notch $\ge$ lowpass cutoff |
| **5. Resampling** | `RESAMPLE` | `raw.resample(sfreq=target_hz, npad='auto')` | OFF (Preserves native rate) |
| **6. Artifact Processing**| `ARTIFACT` | `mne.preprocessing.ICA(method='fastica', random_state=42)` | OFF (`NONE`) by default |
| **7. Integrity Validation**| `FINAL_VALIDATE` | Array-wide scan for NaNs, Infs, flatlines, amplitude outliers | Status must be `HEALTHY` |

---

## 3. Strict Non-Destructive Invariant
1. **Raw Immutability**: The raw input (synthetic generator stream or PhysioNet `.edf` file) is never modified or overwritten in-place.
2. **Deep Cloning**: Processing operates exclusively on deep in-memory clones (`raw = raw_source.copy()`).
3. **Managed Storage**: Processed outputs are saved to `data/processed/` using scientific `.fif` format and content-addressed sidecar `.json` metadata, which are ignored by Git.

---

## 4. Cross-Language Type Parity
- TypeScript: `packages/contracts/src/preprocessing.ts`
- Python: `services/core/neuromove/preprocessing/models.py`
- Database: SQLite `003_preprocessing` migration (`preprocessing_configs`, `preprocessing_results`, `preprocessing_lineage`).
