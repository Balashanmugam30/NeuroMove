# Architecture Document: Artifact Processing & ICA Decomposition

## 1. Artifact Strategy
NeuroMove decouples artifact detection from aggressive automatic signal alteration. Artifact processing is explicit, inspectable, and reproducible:
- **Default Method**: `NONE` (Raw filtered signal preserved without blind component stripping).
- **Optional Method**: `ICA` (Independent Component Analysis via MNE-Python `FastICA`).

---

## 2. Independent Component Analysis (ICA)
When enabled in Research Mode:
1. **High-Pass Prerequisite**: ICA requires high-pass filtered data ($f_{\text{hp}} \ge 0.5-1.0\text{ Hz}$) to prevent low-frequency movement drifts from dominating decomposition.
2. **Decomposition**: MNE `FastICA` decomposes multi-channel scalp data into independent spatial-temporal components ($n_{\text{components}} \le n_{\text{channels}}$).
3. **Random State Control**: Requires an explicit `random_state` (default `42`) to guarantee deterministic matrix convergence across runs.
4. **Explicit Component Exclusion**: Components corresponding to ocular artifacts (blinks/saccades) or cardiac activity must be explicitly listed in `excluded_components` before reconstruction (`ica.apply(raw)`).

---

## 3. Signal Integrity Diagnostics
After pipeline execution, an array-wide computational integrity diagnostic is calculated:
- **NaN / Inf Scanning**: Verifies zero invalid floating-point values.
- **Flatline Channel Detection**: Identifies electrodes with variance $\sigma < 10^{-12}\text{ V}$.
- **Amplitude Outliers**: Detects samples exceeding physiological boundaries ($|x| > 500\,\mu\text{V}$).
- **Integrity Status**: `HEALTHY`, `ANOMALOUS`, or `CORRUPT`.
