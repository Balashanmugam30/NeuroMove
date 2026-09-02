# Personalized Motor-Imagery Calibration & Adaptation Architecture (Phase 13)

## 1. Purpose & Scope
Phase 13 establishes the subject-specific calibration and model adaptation layer for NeuroMove. It connects participant baseline recordings to customized spatial filtering and decoding models while strictly maintaining scientific reproducibility, zero data leakage, and cryptographic lineage.

```
SUBJECT PROFILE
      ↓
CALIBRATION PROTOCOL (Declarative, Seed-Controlled)
      ↓
DETERMINISTIC TRIAL SEQUENCE
  ┌───────────────┴───────────────┐
  ↓                               ↓
SIMULATION (Synthetic ERD)    REPLAY (Recorded EEG)
  └───────────────┬───────────────┘
                  ↓
       TRIAL QUALITY CONTROL (QC)
                  ↓
          VALID EPOCH SET
                  ↓
     PERSONALIZED EXPERIMENT
  ┌───────────────┴───────────────┐
  ↓                               ↓
TRAIN PARTITION (60%)     HELD-OUT PARTITION (40%)
  ↓                               ↓
Fit CSP + Scaler + Decoder   Evaluate Generalization
                                  ↓
                        GENERIC VS PERSONALIZED BENCHMARK
                                  ↓
                        PERSONALIZED MODEL ARTIFACT (pmdl_<hash>)
```

## 2. Inviolable Operational Boundary
- Calibration operates strictly in **OFFLINE_RESEARCH** or **SIMULATION/REPLAY** modes.
- Model predictions and calibration trial outcomes are **NEVER** routed into `SafetyDecision`, `RobotCommand`, or physical actuators.
- Ground truth terminology is strictly "target label", "requested imagery class", or "cue label" — never "true thought" or "brain truth".
- Subject profiles use pseudonymous identifiers (e.g., `sub-001`) with no PII stored.
