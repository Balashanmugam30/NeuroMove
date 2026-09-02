# Real EEG / BioAmp Acquisition Subsystem Architecture

## 1. Executive Summary & Objective

Phase 21 introduces the **Real EEG / BioAmp Acquisition & Ingestion Subsystem** to NeuroMove. This subsystem bridges physical EEG sensors (BioAmp EXG, OpenBCI Cyton/Ganglion, LSL streams, serial ADCs), deterministic motor-imagery signal generators, and byte-for-byte SHA-256 verified recorded replay fixtures into the end-to-end neurophysiology, safety arbitration, and hardware simulation pipeline.

```mermaid
graph TD
    PhysicalBioAmp["Physical BioAmp / ADC<br/>(Passive Sensor Ingestion)"] --> AdapterRouter["Acquisition Adapter Interface<br/>(Physical / Simulator / Recorded)"]
    SyntheticSim["Synthetic MI Generator<br/>(Mu/Beta ERD Engine)"] --> AdapterRouter
    ReplayFixture["Hashed Replay Fixture<br/>(Deterministic SHA-256)"] --> AdapterRouter

    AdapterRouter --> ClockNorm["Clock & Monotonicity Normalizer<br/>(Drift PPM & Jitter Bounds)"]
    ClockNorm --> RingBuffer["Bounded Ring Buffer<br/>(Fixed Time Capacity & Drop Accounting)"]
    RingBuffer --> SignalQC["Statistical Signal QC Engine<br/>(Impedance, Flatline, Saturation, Variance)"]

    SignalQC --> Phase09DSP["Phase 09 Preprocessing / DSP<br/>(Butterworth Bandpass 8-30 Hz)"]
    Phase09DSP --> Phase10Epoch["Phase 10 Epoch & Feature Extraction<br/>(Log-Bandpower & Mu ERD)"]
    Phase10Epoch --> Phase11CSP["Phase 11/12 Decoding Models<br/>(CSP + Classifiers)"]
    Phase11CSP --> Phase15Conf["Phase 15 Confidence Temporal Engine<br/>(Calibrated Confirmation)"]
    Phase15Conf --> Phase16Intent["Phase 16 Intent State Machine<br/>(Lifecycle Tracking)"]
    Phase16Intent --> Phase17Safety["Phase 17 Safety Arbitration Engine<br/>(ExecutionAuthorization Gating)"]
    Phase17Safety --> Phase19Transport["Phase 19 Command Framing & CRC<br/>(Reliable Transport)"]
    Phase19Transport --> Phase20HIL["Phase 20 ESP32 HIL Virtual Endpoint<br/>(Hardware-in-the-Loop)"]

    style PhysicalBioAmp fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style Phase17Safety fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style Phase20HIL fill:#d1fae5,stroke:#059669,stroke-width:2px
```

## 2. Inviolable Safety Invariants

1. **Non-Actuation Invariant**: Physical EEG acquisition is strictly an inbound passive telemetry source. Under zero circumstances are physical motors, PWM drivers, or wheelchair actuators energized.
2. **Authoritative Downstream Endpoint**: All physical EEG data routes exclusively to the Phase 20 ESP32 HIL / virtual serial endpoint.
3. **Pre-flight Authorization Invariant**: No command frame is transmitted across the transport layer unless a valid `ExecutionAuthorization` is issued by the Phase 17 Safety Arbitration Engine. Any `DENIED`, `HELD`, `INVALID`, or uncalibrated state yields `will_transmit=False` and 0 serial frames transmitted.
4. **Honest Hardware Availability**: The physical adapter (`PhysicalEegAcquisitionAdapter`) performs safe non-blocking port probing and honestly reports `is_available: False` when hardware is disconnected. It never fakes physical connection in CI or development.
5. **Deterministic Replay Guarantee**: Recorded replay fixtures use verifiable SHA-256 hashes and monotonic sample indices to guarantee byte-for-byte reproducible offline debugging.
