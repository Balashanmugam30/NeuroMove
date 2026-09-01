# EEG Data Provenance & Reproducibility Specification

## 1. Provenance Invariant
Every scientific analysis result produced by NeuroMove carries an immutable `EEGAnalysisMetadata` object governed by schema version:
```
EEG_ANALYSIS_V1
```

```json
{
  "analysis_id": "anl_psd_a1b2c3d4e5",
  "analysis_version": "EEG_ANALYSIS_V1",
  "session_id": "ses_sim_001",
  "trial_id": "trl_001",
  "source_kind": "SYNTHETIC",
  "mode": "SIMULATION",
  "channels": ["C3", "Cz", "C4"],
  "sampling_rate_hz": 250,
  "method": "welch",
  "frequency_range_hz": [1.0, 40.0],
  "window_seconds": [0.0, 4.0],
  "engine": "MNE-Python 1.12.1",
  "created_at": "2026-09-01T10:00:00.000Z"
}
```

---

## 2. Research Data Exports
Research artifacts exported from the EEG Laboratory preserve complete audit provenance:

### 2.1 Power Spectral Density CSV
Header comments describe the mathematical parameters, sampling frequency, and estimation engine:
```csv
# NEUROMOVE EEG LABORATORY — POWER SPECTRAL DENSITY EXPORT
# Analysis ID, anl_psd_a1b2c3d4e5
# Version, EEG_ANALYSIS_V1
# Mode, SIMULATION
# Source Kind, SYNTHETIC
# Sampling Rate (Hz), 250
# Estimation Method, welch
# Engine, MNE-Python 1.12.1
# Units, uV^2/Hz
# Created At, 2026-09-01T10:00:00.000Z

Frequency_Hz,C3,Cz,C4
1.0,2.15,2.02,2.18
...
```

### 2.2 Band Power CSV
Includes integrated band metrics and the Mu ERD lateralization index:
```csv
# NEUROMOVE EEG LABORATORY — BAND POWER EXPORT
# Analysis ID, anl_bp_f6e5d4c3b2
# Version, EEG_ANALYSIS_V1
# Mode, SIMULATION
# Source Kind, SYNTHETIC
# Lateralization Index, 0.24
# Units, uV^2
# Created At, 2026-09-01T10:00:00.000Z

Channel,Band,Freq_Min_Hz,Freq_Max_Hz,Absolute_Power,Relative_Power
C3,delta,1.0,4.0,12.45,0.142
...
```

### 2.3 Comprehensive Analysis JSON
Contains the unified snapshot:
- 10-20 channel topology coordinates
- Full PSD frequency vectors
- Relative and absolute band distributions
- Morlet time-frequency 2D matrices.
