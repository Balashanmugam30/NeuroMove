# NeuroMove Architecture — Model Version Lineage & Cryptographic Provenance

## 1. Version Graph Structure
Every adapted model registers as a node in a parent-linked Directed Acyclic Graph (DAG) indexed by `model_id` and `parent_model_id`:

```
v1 (Baseline sub-001) [SHA-256: 3a7f...]
  └── v2 (Adapted Session 2) [Parent: v1, SHA-256: 8d2b...]
        └── v3 (Adapted Session 3) [Parent: v2, SHA-256: 4f1c...]
```

```typescript
interface ModelVersion {
  version_id: string;
  model_id: string;
  parent_model_id?: string | null;
  version_number: number;
  scope: "SUBJECT" | "POPULATION";
  subject_id?: string | null;
  status: "ACTIVE_RESEARCH" | "CANDIDATE" | "VALIDATED" | "REJECTED" | "ROLLED_BACK" | "ARCHIVED" | "STALE" | "INVALID";
  is_active: boolean;
  adaptation_id?: string | null;
  model_family: "LDA" | "SVM_LINEAR" | "RIDGE" | "LOGISTIC_REGRESSION";
  representation: "CSP_LOG_POWER" | "BANDPOWER_VECTOR";
  task_id: string;
  metrics: {
    accuracy: number;
    balanced_accuracy: number;
    f1: number;
  };
  artifact_checksum_sha256: string;
  created_at: string;
}
```

---

## 2. Adaptation Manifest (`AdaptationManifest`)
Every adaptation run generates an immutable JSON manifest bundle enabling 100% scientific reproducibility:
- Software Stack: Python version, MNE version, Scikit-Learn version, NeuroMove package version.
- Training Data Fingerprint: SHA-256 over sorted training epoch IDs and signal samples.
- Validation Data Fingerprint: SHA-256 over sorted validation epoch IDs.
- Model Artifact Checksum: SHA-256 digest over serialized `.joblib` pipeline binary.
- Exact Policy Configuration: Thresholds, random state seed, and retention strategy.
- Comparative Benchmark: Confusion matrices, error migration, and promotion audit decision.
