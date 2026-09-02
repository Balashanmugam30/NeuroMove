# NeuroMove — Competition Demo Workflows & Golden Scenarios

## 1. Overview

NeuroMove includes 6 pre-configured Golden Demonstration Scenarios designed for evaluation by competition judges, technical reviewers, and research auditors.

---

## 2. The 6 Golden Demonstration Scenarios

| Scenario ID | Name | Source | Expected Outcome | Safety Verdict | Key Architectural Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`PRODUCT_A`** | Guided Happy Path Baseline | `SIMULATOR` | **`PASS`** | `AUTHORIZED` | Nominal end-to-end flow: 8 EEG channels, CSP decoding, confidence 0.92, 12 safety invariants passed, ESP32 HIL ACK received. |
| **`PRODUCT_B`** | Safety Protection & Gating | `SIMULATOR` | **`BLOCKED`** | `HELD` | Ambiguous motor imagery yields 0.42 confidence (< 0.70 threshold). Phase 17 gate halts execution; 0 transport frames sent. |
| **`PRODUCT_C`** | Sensor Context Invalidation | `SIMULATOR` | **`BLOCKED`** | `HELD` | Auxiliary IMU motion contradiction detected during candidate forward intent. Fusion engine invalidates context; safety hold triggered. |
| **`PRODUCT_D`** | Recorded Replay & Lineage | `RECORDED` | **`PASS`** | `AUTHORIZED` | Replays deterministic benchmark dataset fixture. Bit-for-bit SHA-256 reproducibility verification. |
| **`PRODUCT_E`** | Resilience & Auto-Recovery | `SIMULATOR` | **`PASS`** | `AUTHORIZED` | Injects live channel dropout fault causing transient degradation, followed by automated baseline recalibration and recovery. |
| **`PRODUCT_F`** | Clean State Reset | `SIMULATOR` | **`PASS`** | `AUTHORIZED` | One-click purge of demo run state and WebSocket caches without contaminating underlying research database tables. |

---

## 3. Competition Presentation Guidelines

1. **Explain the Non-Actuation Boundary**: Emphasize that NeuroMove is a software and HIL research platform, not an unregulated direct motor controller.
2. **Demonstrate Safety Interlocks**: Show `PRODUCT_B` and `PRODUCT_C` before `PRODUCT_A` to prove the fail-closed design of the platform.
3. **Verify Scientific Reproducibility**: Run `PRODUCT_D` to display the cryptographic SHA-256 provenance hash and manifest checksums.
