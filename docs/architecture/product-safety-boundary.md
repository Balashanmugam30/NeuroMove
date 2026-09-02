# NeuroMove — Strict Safety Boundary & Non-Actuation Invariants

## 1. Non-Negotiable Safety Invariants

NeuroMove is an institutional software research, neural decoding, and Hardware-in-the-Loop platform. It enforces a strict **Non-Actuation Law**:

1. **Zero Direct Actuation**: No physical sensor (EEG, IMU, EMG, EOG, PPG, Pressure) is ever connected directly to a motor driver, PWM controller, GPIO pin, servo, or relay.
2. **Authoritative Phase 17 Gate**: All candidate intents must pass through the fail-closed Phase 17 Safety Arbitration Engine. No product UI or orchestration shortcut can bypass this gate.
3. **Phase 20 Virtual Endpoint**: All downstream command transmissions are delivered to the Phase 20 ESP32 Virtual Protocol Emulator ($0$ physical motors).
4. **Physical Hardware Honesty**: If physical bio-amplifiers or serial ports are absent, the system explicitly reports `is_available: False` and never silently fakes live hardware readings.

---

## 2. Safety Interlock Execution Flow

```
[ Intent Candidate Generated ]
               │
               ▼
   ┌───────────────────────┐
   │  Confidence >= 0.70?  │──── NO ────► [ SAFETY HELD / BLOCKED ]
   └───────────┬───────────┘                     │
              YES                                ▼
               │                     [ 0 Transport Packets ]
               ▼                     [ 0 Downstream Actions ]
   ┌───────────────────────┐
   │ Sensor Contradiction? │──── YES ───► [ SAFETY HELD / BLOCKED ]
   └───────────┬───────────┘
               NO
               │
               ▼
   ┌───────────────────────┐
   │  12 Safety Invariants │──── FAIL ──► [ SAFETY HELD / BLOCKED ]
   │      Evaluated?       │
   └───────────┬───────────┘
              PASS
               │
               ▼
   [ EXECUTION AUTHORIZATION ]
               │
               ▼
   [ Phase 19 Framed Packet ]
               │
               ▼
   [ Phase 20 ESP32 Virtual ACK ]
```

---

## 3. Contradiction Outcome Precedence

When multi-sensor inputs conflict, the safety gate applies the strict precedence hierarchy:

$$\text{INVALID (0.0 confidence)} \succ \text{HOLD (max 0.40 confidence)} \succ \text{DEGRADED (max 0.70 confidence)} \succ \text{INFORMATIONAL}$$

Any outcome of `HOLD` or `INVALID` immediately forces the downstream safety decision to `HELD` or `DENIED`, ensuring zero unauthorized movement commands are ever framed.
