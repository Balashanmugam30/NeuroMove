# Cross-Validation & Zero Test Data Leakage

## Principle of Zero Information Leakage

In EEG research, spatial filters (such as CSP) and feature normalization scalers learn parameters directly from the data distribution. Fitting spatial filters or scalers across the full dataset prior to partitioning introduces **data leakage**, resulting in artificially inflated accuracy metrics that fail to generalize to novel sessions or subjects.

```
                      INCORRECT (LEAKY) PIPELINE:
  All Epochs ───► [ Fit CSP on All Data ] ───► [ Split Train/Test ] ───► [ Train Classifier ]
                                                      ▲
                                             LEAKAGE: CSP saw test data!

                      CORRECT (LEAKAGE-FREE) PIPELINE:
  All Epochs ───► [ Group Split ] ──┬──► Train Fold ──► [ Fit CSP ] ──► [ Train Classifier ]
                                    │
                                    └──► Test Fold  ──► [ Transform CSP ] ──► [ Predict ]
```

---

## Group-Aware Cross-Validation Protocols

NeuroMove implements strict group-aware evaluation protocols:

### 1. Leave-One-Subject-Out (LOSO)
- Iterates through each subject $s \in S$.
- Train fold: All epochs belonging to subjects $S \setminus \{s\}$.
- Test fold: All epochs belonging exclusively to subject $s$.
- Invariant:
  $$\text{Train\_Subjects} \cap \text{Test\_Subjects} = \emptyset$$

### 2. Group K-Fold & Stratified Group K-Fold
- Divides subjects into $K$ distinct non-overlapping groups.
- Preserves subject grouping across train/test splits.

### 3. Within-Subject K-Fold (Intra-Subject)
- Stratified cross-validation within a single subject's recording sessions.
- Explicitly labeled as `INTRA_SUBJECT` to prevent comparison with inter-subject metrics.

---

## Leakage Invariant Verification

NeuroMove enforces the zero-leakage invariant both at runtime and in automated unit tests (`services/core/tests/test_classical_decoding.py::TestDataLeakageAndEvaluation::test_inter_subject_zero_leakage_invariant`):

1. `build_decoding_pipeline` constructs a composite `sklearn.pipeline.Pipeline([('csp', CSP(...)), ('clf', clf)])`.
2. `pipeline.fit()` is invoked strictly inside the cross-validation loop on $X_{\text{train}}, y_{\text{train}}$.
3. $X_{\text{test}}$ is transformed using the fitted spatial filters without any parameter re-estimation.
4. Overlap between training and testing subjects raises a blocking `RuntimeError`.
