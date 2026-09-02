# End-to-End Live Neurophysiology Pipeline Architecture

## 1. Multi-Stage Pipeline Linking

`LiveNeurophysiologyBridge` unifies all 21 phases into a deterministic, single-pass pipeline execution:

```
Stage 1: Sample Acquisition (8 channels @ 250 Hz)
Stage 2: Butterworth Bandpass Filter (8–30 Hz, 4th Order)
Stage 3: Epoch Segmentation (1000 ms sliding window)
Stage 4: Log-Bandpower & Mu/Beta ERD Feature Extraction
Stage 5: Classifier Decoding (MOVE_FORWARD, TURN_LEFT, TURN_RIGHT, STOP)
Stage 6: Phase 15 Confidence Temporal Confirmation
Stage 7: Phase 16 Intent Lifecycle State Machine
Stage 8: Phase 17 Safety Arbitration & Pre-Flight Validation
Stage 9: Phase 19 Framing & Phase 20 ESP32 HIL Virtual Endpoint Dispatch
```

## 2. Lineage Hashing & Traceability

Every inference output produces an immutable `EegLiveInferenceSummary` containing a SHA-256 lineage hash computed across all pipeline stages:

$$\text{LineageHash} = \text{SHA256}(\text{inference\_id} \parallel \text{session\_id} \parallel \text{subject\_id} \parallel \text{model\_version} \parallel \text{predicted\_class} \parallel \text{confidence} \parallel \text{safety\_decision} \parallel \text{transport\_status})$$

This lineage guarantee ensures that any downstream command frame can be traced back to the exact millisecond biopotential waveform that originated it.
