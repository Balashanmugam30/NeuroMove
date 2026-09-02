# NeuroMove Architecture — Adaptation Policies & Governance

## 1. Adaptation Policy Specification
An `AdaptationPolicy` defines the declarative constraints governing how candidate data batches are accepted, partitioned, trained, and evaluated.

```typescript
interface AdaptationPolicy {
  policy_id: string;
  policy_version: string;
  name: string;
  mode: "BATCH_ADAPTATION" | "CALIBRATION_REFRESH" | "PERSONALIZED_REFRESH";
  scope: "SUBJECT" | "POPULATION";
  min_new_trials: number;
  min_trials_per_class: number;
  max_rejection_ratio: number;
  retention_strategy: "BASELINE_PLUS_NEW" | "NEW_DATA_ONLY" | "NEW_PLUS_RETAINED_DATA";
  imbalance_policy: "REJECT" | "WARN" | "ALLOW";
  max_allowed_regression: number; // e.g. 0.02 (max 2% allowable drop)
  min_promoted_balanced_accuracy: number; // e.g. 0.60
  min_validation_samples: number;
  validation_strategy: "PROTECTED_HOLDOUT" | "TEMPORAL_HOLDOUT";
  random_state: number;
}
```

---

## 2. Standard Baseline Policies

| Policy ID | Scope | Mode | Min Trials | Max Regression | Min Bal. Acc | Retention Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pol_conservative_subject_v1` | `SUBJECT` | `BATCH_ADAPTATION` | 10 | 2.0% | 60.0% | `BASELINE_PLUS_NEW` |
| `pol_rapid_personalized_v1` | `SUBJECT` | `PERSONALIZED_REFRESH` | 6 | 5.0% | 55.0% | `BASELINE_PLUS_NEW` |
| `pol_population_exploratory_v1`| `POPULATION` | `BATCH_ADAPTATION` | 20 | 0.0% | 65.0% | `BASELINE_PLUS_NEW` |

---

## 3. Data Retention Strategies

### A. `BASELINE_PLUS_NEW` (Default)
Preserves all historical baseline trials and concatenates new candidate session epochs into the training partition. Protected validation consists of both historical held-out trials and newly acquired held-out trials.

### B. `NEW_DATA_ONLY`
Trains candidate parameters strictly on newly acquired trials. Useful when baseline data is obsolete or subject morphology has shifted substantially.

---

## 4. Class Imbalance Policy
When candidate batches arrive with skewed label distributions (e.g. 80% left imagery, 20% right imagery):
- `REJECT`: Fails pre-flight preview immediately.
- `WARN`: Allows candidate training with explicit operator warnings on per-class metrics.
- `ALLOW`: Permitted in personalized calibration refresh modes with class weighting.
