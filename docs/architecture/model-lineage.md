# Model Lineage, Provenance & Serialization Integrity

## End-to-End Traceability Chain

Every trained classical decoder in NeuroMove maintains an immutable provenance lineage connecting it directly back through its data generation steps:

```
  Raw Recording (.edf / synthetic)
              ↓
  Phase 08 / Ingested Dataset (PhysioNet EEGBCI)
              ↓
  Phase 09 / Preprocessed Signal (Butterworth 8-30 Hz + CAR + Quality Audit)
              ↓
  Phase 10 / Normalized Epoch Set (Motor-Imagery Trials [-1s, 4s])
              ↓
  Phase 11 / Supervised CSP Spatial Filters + Classical Classifier
              ↓
  Model Artifact (.joblib + .meta.json + SHA-256 Checksum + SQLite Registry)
```

---

## Model Artifact Storage & Checksum Verification

1. **Storage Structure**:
   - Binary estimator: `models/classical/<model_id>.joblib`
   - Manifest sidecar: `models/classical/<model_id>.meta.json`
   - Tabular export: `models/classical/exports/<model_id>_metrics.csv`

2. **Cryptographic Checksum Verification**:
   When saving a model, a streaming SHA-256 hash is computed across the serialized `.joblib` file and recorded in `.meta.json`. During model loading, the checksum is re-verified to prevent tampering, corruption, or version skew:

   ```python
   current_checksum = self._compute_file_sha256(artifact_path)
   if current_checksum != manifest.artifact_checksum_sha256:
       raise ValueError("Model integrity check failed! Checksum mismatch.")
   ```

3. **Reproducibility Software Stack**:
   Every manifest records exact runtime software versions (`mne`, `scikit-learn`, `numpy`, `scipy`) to guarantee scientific reproducibility.
