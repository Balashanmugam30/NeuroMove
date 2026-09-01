# Controlled Variable Ablation Framework

## 1. Scientific Principles

A fundamental requirement in biomedical AI is understanding which algorithmic components deliver genuine performance advantages versus incidental variance.

The NeuroMove Ablation Study Framework enables single-variable isolation where all non-target parameters, random seeds, and outer fold splits are held constant.

---

## 2. Supported Ablation Dimensions

1. **CSP Components (`CSP_COMPONENTS`)**:
   - Compares 2 vs 4 vs 6 extreme spatial filter components.
   - Measures spatial filter over-fitting in low-channel montages.
2. **Model Families (`MODEL_FAMILY`)**:
   - Evaluates Linear Discriminant Analysis vs Linear SVM vs Kernel RBF SVM vs Logistic Regression on identical spatial features.
3. **Feature Scaling (`FEATURE_SCALING`)**:
   - Evaluates the empirical effect of StandardScaler normalization on CSP log variance features.

---

## 3. Metric Delta Formulation

For each variant $v$, the performance delta relative to the baseline configuration $b$ is computed:

$$\Delta \text{Balanced Accuracy}_v = \text{BalancedAccuracy}_v - \text{BalancedAccuracy}_b$$
$$\Delta \text{F1}_v = \text{F1}_v - \text{F1}_b$$
