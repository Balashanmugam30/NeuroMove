# NeuroMove Architecture: Confidence Calibration & Evaluation

## 1. Motivation
Raw machine learning outputs (such as SVM hyperplane distances or uncalibrated softmax logits) are notoriously overconfident or misaligned with empirical event probabilities. Confidence calibration transforms these raw scores into calibrated probabilities:

$$P(Y = y \mid f(X) = s) \approx s$$

---

## 2. Calibration Methods Supported
1. **Platt Scaling**: Logistic regression fitted on validation decision scores:
   $$\sigma(z) = \frac{1}{1 + \exp(-(\alpha s + \beta))}$$
2. **Isotonic Regression**: Non-parametric piecewise constant monotonic mapping.
3. **Margin Sigmoid**: Deterministic scaling parameterized by score dispersion.
4. **Identity**: Direct pass-through for already-calibrated classifiers.

---

## 3. Zero Data Leakage Invariant
Calibration fitting is a supervised transformation and MUST NOT touch evaluation datasets:

$$D_{\text{calib\_fit}} \cap D_{\text{eval\_protected}} = \emptyset$$

If any overlapping epoch identifiers are discovered during fitting, `ConfidenceCalibrator.fit_calibration_profile` raises an immediate `ValueError`.

---

## 4. Statistical Calibration Metrics
Every fitted profile computes and records:
- **Brier Score**:
  $$\text{BS} = \frac{1}{N} \sum_{i=1}^N (p_i - y_i)^2 \quad (\text{ideal: } 0.0)$$
- **Expected Calibration Error (ECE)**:
  $$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
- **Reliability Curve**: Empirical binning of predicted confidence vs observed accuracy across 10 equal-width probability partitions.
- **Coverage & Rejection Rate**: Ratio of decisions accepted at high confidence ($\ge 0.75$).
