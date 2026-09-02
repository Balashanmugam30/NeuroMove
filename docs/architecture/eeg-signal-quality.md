# EEG Signal Quality Control & Calibration Architecture

## 1. Statistical Signal Quality (QC) Engine

`EegSignalQcEngine` analyzes sliding signal windows to classify channel health:

| QC Status | Detection Criterion | Clinical / Technical Significance |
|---|---|---|
| `HEALTHY` | $0.1 < \text{Var} < 25000\ \mu\text{V}^2$, $\max(|x|) < 450\ \mu\text{V}$, $\text{Std} > 0.05\ \mu\text{V}$ | Nominal biopotential recording |
| `FLATLINE` | $\text{Std}(x) < 0.05\ \mu\text{V}$ and $\max(|x|) < 450\ \mu\text{V}$ | Electrode disconnected or ADC dead |
| `SATURATION` | $\max(|x|) \ge 450\ \mu\text{V}$ | Voltage rail clipped or high impedance |
| `NONFINITE` | Contains `NaN` or `Inf` values | Numerical corruption or missing samples |
| `EXCESSIVE_VARIANCE` | $\text{Var}(x) \ge 25000\ \mu\text{V}^2$ | Motion artifact, muscle EMG, or mains hum |
| `LOW_VARIANCE` | $\text{Var}(x) < 0.1\ \mu\text{V}^2$ | Attenuated signal or partial contact |
| `RANGE_VIOLATION` | Exceeds acceptable peak-to-peak amplitude bounds | Gross artifact |

## 2. Live Calibration Workflow & Readiness Gating

Before real-time inference commands can be authorized, subjects must complete the 4-step calibration protocol via `EegCalibrationWorkflow`:

1. **Device Ingestion Setup**: Confirm device connection and sampling rate.
2. **Channel Quality Pre-Check**: Ensure all essential motor channels (C3, Cz, C4) satisfy `HEALTHY` status.
3. **Resting Baseline Acquisition**: Capture 10 seconds of resting baseline to compute per-channel mean and standard deviation:
   $$\mu_c = \frac{1}{N} \sum_{i=1}^N x_{c,i}, \quad \sigma_c = \sqrt{\frac{1}{N} \sum_{i=1}^N (x_{c,i} - \mu_c)^2}$$
4. **Readiness Gate Verdict**: Issue a signed manifest (`EegCalibrationSnapshot`) with SHA-256 hash. If any critical channel is degraded, calibration fails (`is_ready=False`), which causes Phase 17 Safety to issue `DENIED` decisions for all intent commands.
