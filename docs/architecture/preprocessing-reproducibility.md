# Architecture Document: Preprocessing Reproducibility & Fingerprinting

## 1. Content-Addressed Identity
Every preprocessed EEG output receives a deterministic content-addressed identifier:
$$\text{result\_id} = \text{pre\_}\langle\text{config\_hash}\rangle\text{\_}\langle\text{source\_hash}\rangle$$

### Hash Generation:
- **`config_hash`**: SHA-256 digest of canonical, sorted JSON configuration (pipeline version, reference mode, filter cutoffs, notch frequencies, resampling rate, ICA configuration).
- **`source_hash`**: SHA-256 digest of source recording / simulation identifier.

---

## 2. Invalidation & Caching Policy
The `PreprocessingService` queries SQLite and local storage before recomputing:
1. **Cache Hit**: If an identical configuration and source recording were previously processed and the `.fif` artifact exists with a verified SHA-256 checksum, the cached result is returned instantly.
2. **Cache Invalidation**: Modifying any DSP parameter (e.g. changing lowpass cutoff from 40.0 Hz to 35.0 Hz) alters the `config_hash`, guaranteeing that new derived artifacts are generated without overwriting historical runs.

---

## 3. Provenance & Software Environment Capture
Every result artifact is accompanied by a JSON manifest capturing:
- Preprocessing configuration
- Execution durations per stage (in milliseconds)
- Software environment: Python version, MNE version, NumPy version, SciPy version, OS platform
- SHA-256 checksum of the generated FIF artifact
