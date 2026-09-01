# Nested Cross-Validation & Zero-Leakage Protocols

## 1. Problem Formulation: Data Leakage in EEG Machine Learning

EEG recordings exhibit significant non-stationarity, trial-to-trial autocorrelation, and subject-specific spatial topologies. Standard random k-fold cross-validation or fitting spatial filters (e.g. CSP) prior to cross-validation introduces fatal **data leakage**:

1. **Spatial Filter Leakage**: Calculating CSP spatial filters across the combined dataset leaks covariance structure from test trials into training filters.
2. **Hyperparameter Selection Leakage**: Selecting regularizations ($C$, $\gamma$) on the test partition artificially inflates generalization claims.
3. **Subject Identity Leakage**: Randomly splitting trials across subjects tests identity memorization rather than generalized motor imagery intention.

---

## 2. The Two-Loop Nested Protocol

To enforce strict zero-leakage, the AI Model Laboratory implements a dual-loop nested cross-validation hierarchy:

```
Outer Loop (Generalization Evaluation)
├── Outer Fold 1: Train on [Sub_02, Sub_03] ──> Held-Out Test on [Sub_01]
│   └── Inner Loop (Hyperparameter Tuning on Outer Train Data ONLY)
│       ├── Inner Split 1: Train on [Sub_02] ──> Val on [Sub_03]
│       └── Inner Split 2: Train on [Sub_03] ──> Val on [Sub_02]
│       └── Select Best Parameters (e.g., C=1.0)
│   └── Fit Outer Pipeline (CSP + Scaler + LinearSVC(C=1.0)) on [Sub_02, Sub_03]
│   └── Predict on Held-Out [Sub_01]
├── Outer Fold 2: Train on [Sub_01, Sub_03] ──> Held-Out Test on [Sub_02]
└── Outer Fold 3: Train on [Sub_01, Sub_02] ──> Held-Out Test on [Sub_03]
```

### Invariant Checks Enforced in Code
- $\text{train\_subjects} \cap \text{test\_subjects} = \emptyset$ in all inter-subject folds.
- MNE CSP spatial filters are fitted strictly within `Pipeline.fit(X_train, y_train)` during inner and outer folds.
- Every test epoch is evaluated exactly once in held-out status across the entire outer loop, yielding $100\%$ Out-of-Fold prediction coverage.
