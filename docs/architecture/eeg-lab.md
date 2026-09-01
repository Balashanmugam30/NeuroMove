# EEG Laboratory Architecture

## 1. Executive Summary
The NeuroMove **EEG Laboratory** (`/eeg`) is the dedicated research and engineering workspace for real-time electrophysiological signal inspection, multi-channel spectral analysis, electrode contact quality monitoring, and time-frequency visualization prior to motor-imagery classification and robotic control arbitration.

```
+-----------------------------------------------------------------------------------+
|                                 EEG LABORATORY                                    |
|                                                                                   |
|  [EEG Source Card]               [10-20 Channel Topology]                         |
|  - SYNTHETIC EEG (Sim Adapter)   - Central Sulcus (C3, Cz, C4)                    |
|  - 250 Hz Continuous             - Interactive Channel Filtering                  |
|                                                                                   |
|  [Continuous Multi-Channel Oscilloscope]                                          |
|  - Bounded 1000-Sample Ring Buffer (Float32Array)                                 |
|  - Time Windows: 1s, 2s, 4s, 8s, 10s                                              |
|  - Calibrated Vertical Scale: +-40 uV | Pause & Research Cursor                   |
|                                                                                   |
|  [Electrode Quality & Diagnostics Matrix]                                         |
|  - Tier: EXCELLENT / ACCEPTABLE / DEGRADED / DISCONNECTED                         |
|  - C3, Cz, C4 Individual SNR (dB), Sample Dropouts, Continuity                    |
|                                                                                   |
|  [Frequency Domain PSD]                  [Band Power Comparison]                  |
|  - MNE Welch & Multitaper (1-40 Hz)     - Delta, Theta, Mu, Beta, Gamma           |
|  - Peak Frequency Tracking               - Mu ERD Lateralization Index            |
|                                                                                   |
|  [Time-Frequency Representation]         [DSP Preprocessing Overview]             |
|  - Morlet Wavelet Spectrogram (4-40 Hz)  - High-pass, Low-pass, Notch, CAR        |
|  - Non-blocking Async Computation        - Explicit BYPASS/RAW Invariant          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Scientific Transparency & Source Integrity
The electrophysiological stream visualized in Phase 07 originates from the deterministic synthetic EEG generator (`Seed 42`, sampling frequency $f_s = 250\text{ Hz}$).

### Invariants:
1. **Never Clinical Data**: The UI prominently displays badges: `SIMULATION`, `SYNTHETIC EEG`, and scientific attribution disclaimers stating that the signal is a mathematical model for software pipeline verification.
2. **Honest Amplitude Scale**: Potentials are calibrated in microvolts ($\mu\text{V}$) with explicit $\pm 40\mu\text{V}$ range indicators.
3. **Fail-Closed Disconnect Handling**: When failure injection scenarios (such as `eeg-disconnect`) occur, the laboratory displays `LEAD-OFF / DISCONNECTED` with $0\text{ dB}$ SNR rather than fabricating stale or continuous waveforms.

---

## 3. Information Architecture Hierarchy
The laboratory follows a 4-tier visual hierarchy:
- **Level 1 (Top)**: Signal Source Context & 10-20 Scalp Montage (C3 left motor cortex, Cz midline, C4 right motor cortex).
- **Level 2**: Continuous Multi-Channel Waveform Oscilloscope with Bounded Ring Buffer & Electrode Signal Quality Matrix.
- **Level 3**: Power Spectral Density (PSD) with Welch / Multitaper estimation & Sensorimotor Band Power Comparison.
- **Level 4**: Morlet Wavelet Time-Frequency Spectrogram & Non-mutating DSP Preprocessing Pipeline Configuration.
- **Footer**: Analysis Provenance & Reproducibility metadata (`EEG_ANALYSIS_V1`).
