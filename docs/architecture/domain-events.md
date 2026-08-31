# NeuroMove Canonical Event Model

## 1. Universal Event Envelope

Every streaming packet, state change, and telemetry frame is encapsulated inside a single, strongly-typed Canonical Event Envelope:

```json
{
  "event_id": "evt_7f8a9b0c1d2e3f4a",
  "version": "1.0.0",
  "timestamp": "2026-08-31T09:00:00.000Z",
  "session_id": "SESS_20260831_001",
  "user_id": "U001",
  "mode": "SIMULATION",
  "event_type": "DECISION",
  "correlation_id": "corr_123456789abc",
  "source_component": "neuromove-core",
  "payload": {
    "intent": "RIGHT",
    "confidence": 0.92,
    "signal_quality": 0.91,
    "risk": "SAFE",
    "decision": "APPROVED",
    "runtime_state": "CONFIRMED",
    "rationale": "Mu desynchronization sustained over confirmation window."
  }
}
```

## 2. Event Classifications (`EventType`)

- `SYSTEM_STATUS`: Subsystem heartbeat and diagnostic health snapshots.
- `STATE_TRANSITION`: State machine transition audits (`previous_state`, `target_state`, `trigger`).
- `INTENT_CANDIDATE`: Transient classifier prediction before debounce confirmation.
- `INTENT_CONFIRMED`: Temporal confirmation window satisfied.
- `DECISION`: Multi-tier safety arbitration verdict (`APPROVED`, `BLOCKED`, `STOP`).
- `SAFETY_ALERT`: Emergency halts, obstacle triggers, impedance degradation warnings.
- `EMERGENCY_STOP`: Immediate asynchronous hard cutoffs.
- `ROBOT_COMMAND`: Validated velocity dispatch to ESP32 motor driver.
- `TELEMETRY`: Signal quality and battery level reports.
- `CALIBRATION`: Graz cue protocol state synchronization.
