# Deterministic Replay Engine Architecture

## 1. Overview

The `DeterministicReplayEngine` provides byte-for-byte reproducible re-execution of recorded or synthetic EEG signals across all 15 stages of the NeuroMove processing pipeline.

## 2. Replay Execution Modes

| Replay Mode | Time Scale | Buffer Semantics | Primary Use Case |
|---|---|---|---|
| `STRICT` | 1.0x Realtime | Paced Ring Buffer | End-to-end timing validation & latency benchmarks |
| `DETERMINISTIC_ACCELERATED` | Maximum Throughput | High-Speed Async Batch | Fast parameter optimization & fold evaluation |
| `STEP` | Discrete Stepping | Manual Epoch Advance | Interactive debugging & stage inspection |
| `COUNTERFACTUAL` | Perturbed Ingestion | Perturbed Replay | Adversarial stress testing & robustness sweeps |

## 3. The 15-Stage Canonical Pipeline

Every replay run logs a structured `StageResult` for each canonical stage:
1. `SOURCE`: Raw EDF/GDF or synthetic packet stream with SHA-256 data checksum.
2. `ACQUISITION`: Ring buffer packetization and channel alignment.
3. `CLOCK`: Uniform time-base reconstruction (250 Hz) and timestamp jitter removal.
4. `QC`: Amplitude saturation, flatline, and dropout checks.
5. `DSP`: 8–30 Hz Butterworth bandpass and 50 Hz notch filter.
6. `EPOCH`: Event-triggered epoch windowing ($t \in [0.5, 2.5\text{s}]$).
7. `FEATURES`: Log-variance and band-power feature vector extraction.
8. `CSP`: Common Spatial Pattern spatial spatial filtering.
9. `MODEL`: Classifier probability distributions ($P(y \mid x)$).
10. `PERSONALIZATION`: Subject-specific calibration adjustment matrix.
11. `ADAPTATION`: Online covariate-shift update weighting.
12. `CONFIDENCE`: Probability threshold gating ($\ge 0.80$) and temporal confirmation.
13. `INTENT`: Velocity-modulated state machine transitions.
14. `SAFETY`: Arbitration boundaries, velocity envelopes, and e-stop assertions.
15. `HIL`: ESP32 virtual emulator frame serialization and ACK verification.

## 4. Checkpointing and State Resumption

The replay engine periodically creates intermediate checkpoints containing:
- `source_offset`: Index of last ingested packet.
- `epoch_index`: Current trial index.
- `manifest_hash`: Fingerprint of active experiment configuration.
- `intermediate_checksum`: Running SHA-256 state hash.
- `state_payload_json`: Serialized DSP filter buffers, CSP projections, and adaptation weights.
