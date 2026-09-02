# Hardware-in-the-Loop (HIL) Integration & Validation Architecture

## 1. Executive Summary

Phase 20 introduces the **Hardware-in-the-Loop (HIL) Integration & Validation** subsystem to the NeuroMove platform. Positioned downstream of Phase 17 (Safety Arbitration), Phase 18 (Resilience Laboratory), and Phase 19 (Command Transport Protocol), Phase 20 validates that the software communication protocol communicates reliably with ESP32-compatible endpoints across simulated, virtual serial, and physical laboratory hardware interfaces.

```
EEG / Simulation
      ↓
DSP / Features
      ↓
Active Model (Decoders)
      ↓
Prediction
      ↓
Phase 15 — Confidence + Temporal Confirmation
      ↓
Phase 16 — Canonical Intent State Machine
      ↓
Phase 17 — Safety Arbitration & Interlocking Rules
      ↓
Phase 18 — Resilience & Fault Verification
      ↓
Phase 19 — Command Transport Protocol (Frame Construction)
      ↓
Phase 20 — HARDWARE-IN-THE-LOOP INTEGRATION (THIS PHASE)
      ├── SimulatedEsp32Adapter (In-Memory Simulation)
      ├── VirtualSerialAdapter (Virtual Duplex Byte Channel)
      └── SerialEsp32Adapter (Physical UART / USB Serial)
            ↓
ESP32-Compatible Microcontroller Endpoint
```

---

## 2. Core Safety & Non-Actuation Boundaries

1. **Phase 17 Upstream Safety Invariance (`SAFETY_AUTHORIZATION_INVIOLABLE`)**:
   - Phase 20 strictly enforces the upstream `ExecutionAuthorization` contract.
   - A command frame is never constructed or transmitted unless `decision == AUTHORIZED`, `now < expires_at`, and all cryptographic provenance identifiers are present.
   - `DENIED`, `HELD`, `EMERGENCY_STOP`, `LOCKED_OUT`, `INVALID`, and `EXPIRED` states strictly produce **0 execution transmissions**.

2. **Laboratory HIL Profile Only (`NO_PRODUCTION_ACTUATION`)**:
   - Physical ESP32 microcontrollers connected in Phase 20 operate strictly under the `HIL_ONLY` profile.
   - No GPIO pins, PWM motor drivers, relays, servos, vehicle wheels, or wheelchair motors are actuated.
   - The UI displays `"Hardware-in-the-Loop — No Production Actuation"`.

3. **CI-Safe Virtual HIL Strategy**:
   - Continuous Integration (CI) never depends on physical serial hardware.
   - Full HIL-equivalent testing executes deterministically in pure Python using `VirtualSerialAdapter` connected to `Esp32ProtocolEmulator`.

---

## 3. Phase 21 Handoff

Phase 20 establishes the downstream embedded validation boundary. Phase 21 (Real EEG / BioAmp Acquisition) will integrate real biological EEG acquisition hardware on the upstream ingestion side, feeding real signals into the existing:

$$\text{EEG Acquisition} \longrightarrow \text{DSP} \longrightarrow \text{Decoders} \longrightarrow \text{Confidence} \longrightarrow \text{Intent} \longrightarrow \text{Safety} \longrightarrow \text{Protocol} \longrightarrow \text{HIL Adapter}$$
