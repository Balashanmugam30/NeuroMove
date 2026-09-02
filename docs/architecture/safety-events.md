# Safety Real-Time Events, WebSocket Stream & Downstream Boundaries

## 1. Canonical Event Taxonomy

Phase 17 defines 9 canonical events broadcast over WebSocket stream `TransportStream.SAFETY`:

| Event Type | Trigger | Payload Summary |
| :--- | :--- | :--- |
| `SAFETY_EVALUATED` | Generic arbitration evaluation completed | Decision, state, evaluation_id, primary_reason |
| `SAFETY_AUTHORIZED` | All safety rules pass | Decision=AUTHORIZED, state=AUTHORIZED, intent_id |
| `SAFETY_HELD` | Operator hold or temporary hold active | Decision=HELD, state=HELD, reason |
| `SAFETY_DENIED` | Safety constraint actively rejected intent | Decision=DENIED, state=DENIED, violated_rules |
| `SAFETY_EMERGENCY_STOP` | Software emergency stop asserted | Asserted_by, reason, state=EMERGENCY_STOP |
| `SAFETY_LOCKED_OUT` | Failure threshold exceeded or manual lockout | Failure_count, reason, state=LOCKED_OUT |
| `SAFETY_RESET` | State reset to SAFE_IDLE or RESET_PENDING | Status, cleared_by |
| `SAFETY_HOLD_CHANGED` | Operator hold engaged or released | Operator_hold: boolean, operator_id, reason |
| `SAFETY_CONTEXT_CHANGED` | Safety context or policy parameters updated | Policy_version, checksum |

---

## 2. Event Envelope Structure

Every emitted event conforms to the canonical `EventEnvelope`:

```json
{
  "event_id": "evt_4b8f01c9a12e",
  "event_type": "SAFETY_AUTHORIZED",
  "stream": "safety",
  "mode": "SIMULATION",
  "timestamp": "2026-09-02T14:00:00.000Z",
  "payload": {
    "evaluation_id": "eval_7a1b3c5d7e9f",
    "decision": "AUTHORIZED",
    "state": "AUTHORIZED",
    "primary_reason": "All configured software safety constraints pass.",
    "intent_id": "int_48f90a12",
    "subject_id": "sub_01",
    "session_id": "sess_01",
    "policy_version": "1.0.0",
    "timestamp": "2026-09-02T14:00:00.000Z"
  }
}
```

---

## 3. Downstream Interface Boundary

Phase 17 terminates strictly at the creation and broadcast of the `SafetyEvaluation` and `SafetyStateSnapshot`.

- **Software Output**: Downstream systems receive an auditable authorization token (`SafetyEvaluation`) certifying that software checks passed.
- **Actuation Invariant**: Phase 17 executes **zero robot, motor, ESP32, or actuator commands**. Future hardware execution modules (Phase 19+) will consume this authorization artifact before physical dispatch.
