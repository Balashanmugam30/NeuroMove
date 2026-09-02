# NeuroMove Phase 22 — Research Analytics Platform Architecture

## 1. Executive Summary & Objective

The **NeuroMove Research Analytics Platform** establishes a research-grade, offline/HIL deterministic replay and scientific evaluation engine. It enables researchers and clinical neuroscientists to evaluate, benchmark, compare, stress-test, and verify electrophysiological brain-computer interface pipelines with mathematical rigor and strict provenance guarantees.

```mermaid
graph LR
    SRC[SOURCE EEG / BIOAMP] --> MAN[IMMUTABLE MANIFEST]
    MAN --> REP[REPLAY ENGINE]
    REP --> ACQ[ACQUISITION]
    ACQ --> CLK[CLOCK NORMALIZATION]
    CLK --> QC[SIGNAL QC]
    QC --> DSP[DSP FILTERING]
    DSP --> EPOCH[EPOCHING]
    EPOCH --> FEAT[FEATURE EXTRACTION]
    FEAT --> CSP[CSP DECOMPOSITION]
    CSP --> MDL[MODEL INFERENCE]
    MDL --> PERS[PERSONALIZATION]
    PERS --> ADP[ONLINE ADAPTATION]
    ADP --> CNF[CONFIDENCE CALIBRATION]
    CNF --> INT[INTENT STATE MACHINE]
    INT --> SFT[SAFETY ARBITRATION]
    SFT --> HIL[ESP32 HIL EMULATOR]
    HIL --> ANA[SCIENTIFIC ANALYTICS]
    ANA --> AUD[REPRODUCIBILITY AUDIT]
    AUD --> EXP[ARTIFACT EXPORT]
```

## 2. Core Pillars & Invariants

1. **Deterministic Replay Execution**:
   - Replay execution modes: `STRICT` (real-time pacing), `DETERMINISTIC_ACCELERATED` (asynchronous high-throughput batching), `STEP` (single epoch stepping), and `COUNTERFACTUAL` (perturbed input exploration).
2. **Provenance & Manifest Immutability**:
   - Every experiment manifest is canonically serialized to compact, key-sorted JSON and hashed using SHA-256.
   - Once sealed, a parent manifest cannot be modified. Parameter changes spawn child manifests with explicit delta lineage.
3. **Strict Non-Actuation Guarantee**:
   - The research evaluation pipeline operates in an observational offline / HIL boundary.
   - Downstream dispatches route exclusively to the Phase 20 ESP32 virtual emulator. Zero physical motors, actuators, or PWM channels are energized.
4. **Comprehensive Metric Formulation**:
   - Balanced accuracy, macro F1, Expected Calibration Error (ECE), Brier score, and latency percentiles ($p_{50}, p_{90}, p_{95}, p_{99}$).
   - Missing or unsupported metrics strictly yield `null` / `NOT_AVAILABLE` rather than synthetic placeholders.
