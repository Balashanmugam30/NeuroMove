# Subject Profiles, Cryptographic Lineage & Version History

## 1. Pseudonymous Subject Profiles
- Subject profiles contain only research-relevant metadata (`subject_id`, `preferred_hand`, optional notes).
- No personally identifiable information (PII) is stored or derived from filesystem usernames or network addresses.

## 2. Cryptographic Identifiers & Integrity
- **Personalized Model ID**: `pmdl_<hash>` computed deterministically from `(subject_id, calibration_id, model_config, training_data)`.
- **Model Checksum**: SHA-256 digest computed over the serialized `.joblib` binary pipeline to prevent tampering.
- **Calibration Manifest**: Structured JSON/Markdown audit bundle capturing software versions, trial sequences, and split hashes.

## 3. Version History & Immutability
- Historical calibration versions (`v1`, `v2`, `v3`) are append-only.
- Prior calibration records and fitted model artifacts are preserved permanently in SQLite and managed disk storage.
