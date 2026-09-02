# Generic vs. Personalized Model Adaptation & Leakage-Safe Evaluation

## 1. Zero Data Leakage Invariant
To guarantee scientific validity:
$$\text{train\_trials} \cap \text{heldout\_trials} = \emptyset$$

- **Partitioning**: Temporal block split (early 60% trials for training, late 40% trials for held-out generalization).
- **Fitting**: Common Spatial Patterns (CSP) spatial filters, feature scalers, and classifier parameters (LDA / Linear SVM) are fitted exclusively on the training partition.
- **Evaluation**: Generalization is measured on the untouched held-out partition.

## 2. Generic Baseline Benchmarking
- The generic baseline model from Phase 11/12 remains immutable.
- Both the generic model and the newly fitted personalized model are evaluated on the **exact same held-out test partition**.
- **Personalization Delta**:
$$\Delta \text{Balanced Accuracy} = \text{Balanced Accuracy}_{\text{Personalized}} - \text{Balanced Accuracy}_{\text{Generic}}$$
$$\Delta \text{F1} = \text{F1}_{\text{Personalized}} - \text{F1}_{\text{Generic}}$$
- Deltas represent empirical measurements without artificial inflation.
