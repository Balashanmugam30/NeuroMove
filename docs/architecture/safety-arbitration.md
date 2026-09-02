# Safety Arbitration, Constraint Evaluation & Execution Authorization Gate

## 1. Architectural Role & Context

Phase 17 introduces the **authoritative software safety arbitration gate** (`NEUROMOVE-P17`) for NeuroMove. It is situated strictly between Phase 16 (Canonical Intent State Machine) and future downstream hardware execution interfaces:

```
Active Model Version (Phase 14)
       ↓
Prediction
       ↓
Confidence Estimation & Temporal Confirmation (Phase 15)
       ↓
Canonical Intent State Machine (Phase 16)
       ↓
PHASE 17 SAFETY ARBITRATION GATE
       ↓
[AUTHORIZED / HELD / DENIED / EMERGENCY_STOP / LOCKED_OUT]
       ↓
Future Hardware / Robot Execution Interfaces (Phase 19+)
```

Phase 17 addresses the essential question:
> *"Given an authoritative Phase 16 intent, current system/context conditions, configured safety constraints, and current safety state, is that intent admissible for downstream execution?"*

---

## 2. Non-Negotiable Safety Principles

1. **Principle A — Fail Closed**:
   If safety arbitration cannot establish complete, verifiable validity of all required inputs, the outcome must be `DENIED` or `HELD`. The system **never** defaults to allow on missing, degraded, or unknown data.
2. **Principle B — Explicit Authorization**:
   An `ACTIVE` intent in Phase 16 does **not** equal execution clearance. A distinct Phase 17 arbitration evaluation is required to reach `AUTHORIZED`.
3. **Principle C — Backend Authoritative**:
   All safety states, constraint evaluations, precedence resolutions, emergency stop flags, lockouts, and audit logs are owned by the backend. The frontend is an observer and request dispatcher only.
4. **Principle D — Deterministic Arbitration**:
   Identical `(intent, context, policy, time)` tuples produce mathematically identical arbitration outcomes, enabling reliable reproduction and simulation.
5. **Principle E — No Silent Overrides**:
   No rule may covertly convert `DENIED` $\to$ `AUTHORIZED` or `EMERGENCY_STOP` $\to$ `AUTHORIZED`.
6. **Principle F — Fail-Safe Precedence**:
   When multiple safety constraints are simultaneously triggered, the more restrictive outcome wins according to an explicit, documented precedence hierarchy.

---

## 3. Absolute Scope Boundaries

### In Scope
- Canonical software safety domain and data models.
- Modular 13-rule evaluation engine.
- 9-level deterministic precedence resolver.
- Upstream Phase 16 intent eligibility gating (`ACTIVE` only).
- Software emergency-stop state and manual operator hold.
- Consecutive failure lockout and verified reset sequence.
- Rate-limiting (sliding window) and continuous duration limits.
- SQLite audit persistence (Migration `011_safety_arbitration`).
- Real-time transport streaming (`TransportStream.SAFETY`).
- Deterministic simulation scenarios (Scenarios A through O).
- Professional research/operator `/safety` workspace.

### Explicitly Out of Scope
- No physical robot commands, motor commands, servo signals, or ESP32 packets.
- No hardware interfaces or hardware-in-the-loop circuits.
- No physical emergency-stop hardware, physical braking, or physical collision avoidance.
- No claims of physical or clinical safety.
