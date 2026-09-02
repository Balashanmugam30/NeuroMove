# Experiment Reproducibility & Tamper Detection Architecture

## 1. Multi-Tier Reproducibility Verification

The `ReproducibilityChecker` audits rerun experiments across four levels:

```mermaid
graph TD
    A[Rerun Triggered] --> B{Source Checksum Match?}
    B -- No --> FAIL1[Status: FAIL (Source Tampered)]
    B -- Yes --> C{Manifest Hash Match?}
    C -- No --> FAIL2[Status: FAIL (Config Drift)]
    C -- Yes --> D{Result Hash Exact Match?}
    D -- Yes --> PASS[Status: PASS (Exact Byte Match)]
    D -- No --> E{Metrics Delta <= Tolerance?}
    E -- Yes --> APPROX[Status: APPROXIMATE (Within 1e-4)]
    E -- No --> FAIL3[Status: FAIL (Numerical Drift Exceeded)]
```

## 2. Verdict Status Definitions

- **`PASS`**:
  - Source data checksums identical.
  - Manifest configuration hash identical.
  - Stage checksums and total result hash identical byte-for-byte.
- **`APPROXIMATE`**:
  - Source data and manifest hashes match.
  - Metrics differ by $|\Delta| \le \text{tolerance.absolute}$ ($10^{-4}$).
- **`FAIL`**:
  - Source data altered, configuration drift detected, or metric deviation exceeded tolerance.
