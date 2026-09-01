# Classical Model Benchmarks & Evaluation Standards

## Motor-Imagery Benchmark Standards

In NeuroMove, classical model evaluation follows rigorous scientific guidelines:

1. **Explicit Task Definitions**:
   - `LEFT_VS_RIGHT_MOTOR_IMAGERY_V1`: Binary contralateral sensorimotor rhythm decoding (C3 vs C4).
   - `FEET_VS_FISTS_V1`: Binary sagittal vs bilateral motor-cortex activation (Cz vs C3/C4).
   - Unmapped, ambiguous, or rest intervals are explicitly excluded with transparent counts.

2. **Reporting Standards**:
   - Models must report **Balanced Accuracy**, **Accuracy**, and **F1 Score** alongside standard deviation across folds ($\mu \pm \sigma$).
   - The theoretical chance level (e.g., $50.0\%$ for balanced binary tasks) must always be shown.
   - Results must include per-subject performance breakdowns to highlight inter-subject BCI variability.

---

## Benchmark Comparisons

| Model Family | Spatial Filtering | Classifier | Feature Space | Evaluation Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Baseline Dummy** | None | Stratified Prior | None | Leave-One-Subject-Out |
| **Canonical CSP + LDA** | MNE CSP (4 components) | SVD Linear Discriminant | Log-Power ($\mathbb{R}^4$) | Leave-One-Subject-Out |
| **CSP + Linear SVM** | MNE CSP (4 components) | Linear SVC ($C=1.0$) | Log-Power ($\mathbb{R}^4$) | Leave-One-Subject-Out |
| **CSP + RBF SVM** | MNE CSP (4 components) | RBF SVC ($C=1.0, \gamma=\text{scale}$) | Log-Power ($\mathbb{R}^4$) | Leave-One-Subject-Out |

---

## Disclaimers & Boundary Conditions

- **No Clinical Validation**: Public recorded datasets and synthetic simulations serve as algorithm engineering benchmarks and do not constitute clinical efficacy.
- **No Direct Actuation**: Benchmark model predictions are purely observational. Safety-critical robotic commands are deferred to downstream confidence arbitration layers.
