# Model Cards & Cryptographic Provenance

## 1. Structured Model Cards (Mitchell et al. / Research Standards)

Every trained estimator in the NeuroMove Model Registry is automatically packaged with a comprehensive Model Card available in both structured JSON and GitHub-flavored Markdown formats.

### Model Card Schema:
- **Intended Use**: Explicit statement of offline research benchmarking scope and non-clinical status.
- **Training Data Summary**: Dataset source, epoch set identifier, subject count, trial counts.
- **Validation Protocol**: Group cross-validation mode, fold assignment hashes.
- **Performance Benchmark**: Balanced accuracy, overall accuracy, weighted F1, and theoretical chance level.
- **Known Limitations & Failure Modes**: Documented environmental and neurological failure conditions.
- **Software Stack Environment**: Exact pinned versions of `mne`, `scikit-learn`, `numpy`, and `neuromove`.
- **Cryptographic SHA-256 Checksum**: Deterministic digest verifying `.joblib` model artifact immutability.
