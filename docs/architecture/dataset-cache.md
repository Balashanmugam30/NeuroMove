# NeuroMove Dataset Cache & Storage Policy

## 1. Managed Directory Layout
All dataset files are managed under the repository `data/` root:

```
data/
├── cache/            # Local downloaded scientific data (IGNORED by Git)
│   └── physionet/
│       └── S001/
│           └── S001R04.edf
├── downloads/        # Temporary partial downloads (IGNORED by Git)
├── manifests/        # Exported reproducibility manifests (COMMITTED)
│   └── manifest_physionet-eegbci.json
├── metadata/         # Normalized dataset metadata snapshots (COMMITTED)
└── fixtures/         # Lightweight test fixtures for offline CI (COMMITTED)
```

---

## 2. Path Traversal & Security Protection
To prevent directory traversal vulnerabilities (e.g. `../../etc/passwd`), `DatasetStorage.resolve_safe_path` resolves canonical absolute paths and ensures they remain strictly inside the authorized subdirectories (`cache_dir`, `fixtures_dir`, `manifests_dir`). Any attempt to escape raises a `ValueError("Security violation: path traversal detected")`.

---

## 3. Git Ignore Policy
The root `.gitignore` contains rules guaranteeing large scientific raw recordings (`.edf`, `.bdf`, `.fif`, `.mat`, `.npy`, `data/cache/*`, `data/downloads/*`) are never committed to version control, while preserving `.gitkeep`, `data/manifests/`, `data/metadata/`, and `data/fixtures/`.
