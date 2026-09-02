# Research Evaluation & Scientific Metrics

## 1. Classification Metrics

- **Accuracy**:
  $$\text{Acc} = \frac{1}{N} \sum_{i=1}^N \mathbb{I}(\hat{y}_i = y_i)$$
- **Balanced Accuracy**:
  $$\text{Balanced Acc} = \frac{1}{K} \sum_{k=1}^K \text{Recall}_k$$
- **Macro Precision, Recall, and F1**:
  $$\text{Precision}_k = \frac{\text{TP}_k}{\text{TP}_k + \text{FP}_k}, \quad \text{Recall}_k = \frac{\text{TP}_k}{\text{TP}_k + \text{FN}_k}, \quad \text{F1}_k = 2 \cdot \frac{\text{Precision}_k \cdot \text{Recall}_k}{\text{Precision}_k + \text{Recall}_k}$$
  $$\text{F1}_{\text{macro}} = \frac{1}{K} \sum_{k=1}^K \text{F1}_k$$

## 2. Probabilistic Calibration & Calibration Error

- **Expected Calibration Error (ECE)**:
  Binned reliability curve with $M=10$ uniform probability bins:
  $$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
- **Brier Score (Multi-Class Mean Squared Error)**:
  $$\text{Brier} = \frac{1}{N} \sum_{i=1}^N \sum_{k=1}^K (p_{ik} - y_{ik})^2$$

## 3. Statistical Comparison & Bootstrapping

- **Deterministic Seeded Bootstrap 95% Confidence Interval**:
  1,000 bootstrap resamples seeded with `manifest.seed`.
- **Cohen's $d$ Effect Size**:
  $$d = \frac{\bar{x}_1 - \bar{x}_2}{s_{\text{pooled}}}$$
- **Paired $t$-Test $p$-value**:
  Parametric paired comparison between baseline and candidate configurations.
