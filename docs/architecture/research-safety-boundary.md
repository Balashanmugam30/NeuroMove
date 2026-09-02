# Research Safety & Non-Actuation Guarantee

## 1. Observational Execution Boundary

The NeuroMove Research Analytics Platform enforces a strict non-actuation boundary:

```
[RESEARCH MANIFEST]
         │
         ▼
[DETERMINISTIC REPLAY]
         │
         ▼
[PHASE 17 SAFETY ARBITRATION]  <-- Authoritative safety validation
         │
         ▼ (Evaluative Framing Only)
[PHASE 20 ESP32 HIL EMULATOR]  <-- Virtual endpoint / Mock HIL
         │
      [BLOCKED]
         │
   ❌ NO MOTOR PWM / ZERO PHYSICAL ACTUATION
```

## 2. Invariant Proofs

1. **Zero Physical Actuation**:
   - `TransportStream.RESEARCH` and replay endpoints never connect to serial physical COM ports.
   - Replay frames route exclusively to the virtual ESP32 emulator.
2. **Safety Pipeline Authority**:
   - Research replay signals undergo full Phase 17 Safety Arbitration.
   - Low confidence ($< 0.80$) or degraded signal states trigger safe rejection and zero frame transmission.
3. **Immutability of Sealed Evidence**:
   - Historical experiment records and artifacts cannot be overwritten or altered.
