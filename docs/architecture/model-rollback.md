# NeuroMove Architecture — Model Rollback & Reversibility Protocol

## 1. Rollback Mechanism
Every model version created within NeuroMove is immutable and retained in database lineage. If an operator discovers performance inconsistencies in offline replay or domain changes after a candidate has been promoted, the system provides instantaneous rollback to any prior validated version ($v1 \leftarrow v2 \leftarrow v3$).

```mermaid
stateDiagram-v2
    [*] --> v1_Active: Baseline Model (v1, ACTIVE)
    v1_Active --> v2_Candidate: Adaptation Run (v2, CANDIDATE)
    v2_Candidate --> v2_Active: Explicit Promotion
    v1_Active --> v1_Validated: Deactivated (VALIDATED)

    state "Rollback Triggered" as RB {
        v2_Active --> v2_RolledBack: Marked ROLLED_BACK (is_active=False)
        v1_Validated --> v1_Reactivated: Reactivated v1 (is_active=True)
    }
```

---

## 2. Reversibility Invariants
1. **History Preservation**: Rolling back never deletes model weights (`.joblib`), metadata, metrics, or validation manifests.
2. **Audit Logging**: Every rollback operation generates an immutable `RollbackEvent` record storing:
   - `from_model_id`: The model version being deactivated.
   - `to_model_id`: The target model version being reactivated.
   - `reason`: Operator-provided explanation.
   - `operator_action`: `"MANUAL_ROLLBACK"`.
   - `timestamp`: UTC ISO timestamp.
3. **Target Eligibility**: Rollback can only target previously `VALIDATED` or `ACTIVE_RESEARCH` versions. Models marked `REJECTED` or `INVALID` are ineligible for reactivation.
