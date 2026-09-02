# Trial Quality Control (QC) & Data Sufficiency

## 1. Electrophysiological Audits
Every recorded calibration trial is evaluated across multi-stage research QC checks:
- **Non-Finite Data**: Detection of `NaN` or `Inf` floating point values (`NONFINITE_DATA`).
- **Trial Completeness**: Minimum sample length verification (`INCOMPLETE_EPOCH`).
- **Electrode Flatline / Dropouts**: Zero-variance difference checks (`DROPOUT`).
- **Amplitude Bounds**: Peak-to-peak amplitude $0.1\,\mu\text{V} \le V_{\text{pp}} \le 200\,\mu\text{V}$ (`SIGNAL_QUALITY_LOW`, `OUT_OF_BOUNDS`).

## 2. Categorization & Non-Clinical Terminology
- Statuses: `PASS`, `WARN`, `REJECT`
- Wording is strictly engineering and research-oriented.

## 3. Data Sufficiency Criteria
Before model personalization is unlocked:
- Rejection Ratio: $\le 40\%$
- Minimum Valid Trials Per Class: $\ge 5$
- Target Classes: $\ge 2$
