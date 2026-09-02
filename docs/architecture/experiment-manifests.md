# Experiment Manifests & Provenance Architecture

## 1. Immutable Manifest Design

An `ExperimentManifest` captures the complete configuration space required to reproduce a NeuroMove scientific experiment.

```json
{
  "manifest_id": "man_3a7b9c4d8e1f",
  "app_version": "1.0.0",
  "git_commit": "63c8584",
  "source_session_ids": ["sess_mi_sub01_01"],
  "source_checksums": { "sess_mi_sub01_01": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
  "channel_names": ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"],
  "sampling_rate": 250.0,
  "montage": "10_20_STANDARD",
  "dsp_config": { "lowcut": 8.0, "highcut": 30.0, "notch": 50.0, "order": 4 },
  "epoch_config": { "tmin": 0.5, "tmax": 2.5, "baseline": [-0.5, 0.0] },
  "model_id": "lda_csp_mi_v1",
  "seed": 42,
  "numerical_tolerances": { "absolute": 0.0001, "relative": 0.001 },
  "manifest_hash": "3a7b9c4d8e1f029384756abcdef1234567890abcdef1234567890abcdef123456",
  "is_sealed": true
}
```

## 2. Canonical JSON Serialization & Hashing Invariant

To guarantee that two identical configurations produce byte-for-byte identical hashes:
1. Volatile fields (`manifest_id`, `experiment_id`, `created_at`, `sealed_at`, `manifest_hash`) are stripped.
2. Dictionaries are deeply sorted by key.
3. Floats are formatted with consistent precision.
4. The canonical string is encoded as UTF-8 and hashed via SHA-256.

```python
def canonical_hash(data: dict) -> str:
    cleaned = strip_volatile_fields(data)
    canonical_json = json.dumps(cleaned, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
```

## 3. Child Manifests & Lineage Preservation

When an experiment is ablated or modified:
- The parent manifest remains strictly immutable.
- A new child experiment is instantiated with `parent_experiment_id`.
- The child manifest includes only the parameter delta on top of the parent.
