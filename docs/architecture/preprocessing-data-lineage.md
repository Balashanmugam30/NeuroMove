# Architecture Document: Preprocessing Data Lineage & Derived Results

## 1. Lineage Graph Model
NeuroMove explicitly models data lineage between raw sources and derived signal processing artifacts:

```
                  RAW RECORDING / SIMULATION
               (Immutable Root: `rec_eegbci_S001_R04`)
                              │
                              ▼
                PREPROCESSING RESULT A (`result_id_A`)
                 (0.5–40 Hz Band-Pass, Average Ref)
                              │
                              ▼
                PREPROCESSING RESULT B (`result_id_B`)
                 (ICA Artifact Excluded: parent = `result_id_A`)
```

---

## 2. Lineage Database Schema
The relational table `preprocessing_lineage` records parent-child relationships:
```sql
CREATE TABLE IF NOT EXISTS preprocessing_lineage (
    child_result_id TEXT NOT NULL,
    parent_result_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (child_result_id, parent_result_id)
);
```

---

## 3. Derived-on-Derived Guards
When a user initiates preprocessing on an already preprocessed artifact, the system:
1. Emits a visual lineage badge indicating derived status.
2. Binds `parent_result_id` into the metadata sidecar and database index.
3. Prevents circular dependencies in signal conditioning graphs.
