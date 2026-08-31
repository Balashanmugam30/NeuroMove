# NeuroMove Universal Canonical Event System

## 1. Overview

NeuroMove utilizes an immutable, append-oriented canonical event system for all runtime streaming, safety auditing, database persistence, and research replay.

---

## 2. Universal Canonical Event Envelope

Every event produced by the Python Control Station, streamed across WebSockets, or consumed by the Next.js web application conforms to the strongly typed envelope:

```json
{
  "event_id": "evt_9a4f21bc08412e89",
  "schema_version": "1.0.0",
  "timestamp": "2026-08-31T10:00:01.120Z",
  "occurred_at": "2026-08-31T10:00:01.100Z",
  "processed_at": "2026-08-31T10:00:01.120Z",
  "mode": "SIMULATION",
  "event_type": "PREDICTION",
  "session_id": "ses_98f12a4b1234",
  "trial_id": "trl_01a2b3c4d5e6",
  "user_id": "usr_9921ab45ef",
  "correlation_id": "cor_78ef9012a456",
  "source": "neuromove.inference",
  "sequence": 101,
  "payload": {
    "intent": "RIGHT",
    "class_probabilities": {
      "LEFT": 0.05,
      "RIGHT": 0.92,
      "FORWARD": 0.02,
      "BACKWARD": 0.01
    },
    "neural_confidence": 0.92,
    "raw_label": "class_2_right_hand",
    "model_id": "mdl_csp_lda_001",
    "model_version": "1.0.0",
    "window_id": "win_0042"
  }
}
```

---

## 3. Event Taxonomy

### System Lifecycle & Health

- `SYSTEM_STARTED`: Control Station boot.
- `SYSTEM_STOPPED`: Safe shutdown.
- `SYSTEM_STATUS`: Diagnostic health report.

### Session Lifecycle

- `SESSION_CREATED`, `SESSION_STARTED`, `SESSION_PAUSED`, `SESSION_RESUMED`, `SESSION_ENDED`

### Trial Protocol

- `TRIAL_STARTED`: Fixation onset.
- `TRIAL_CUE`: Visual cue presentation.
- `TRIAL_IMAGERY_STARTED`: Motor-imagery execution window.
- `TRIAL_ENDED`: Rest and trial summary.

### EEG Stream & Quality

- `EEG_PACKET`: Raw high-frequency multichannel chunk.
- `EEG_WINDOW`: Preprocessed bandpass/CAR window.
- `EEG_SIGNAL_QUALITY`: Impedance and SNR metrics.
- `EEG_DISCONNECTED`: Lead-off or serial disconnection alert.

### Prediction & Intent

- `PREDICTION`: Spatial filter and classifier posterior probabilities.
- `INTENT_CANDIDATE`: Single-epoch candidate detection.
- `INTENT_CONFIRMED`: Debounced, multi-epoch confirmed user intent.
- `INTENT_REJECTED`: Intent rejected due to insufficient confidence or decay.

### Safety & Arbitration

- `STATE_TRANSITION`: State machine state shift.
- `SAFETY_CHECK`: Active evaluation of candidate command.
- `SAFETY_APPROVED`: Command authorized for dispatch.
- `SAFETY_BLOCKED`: Command halted by proximity or state barrier.
- `SAFETY_STOP`: Safe zero-velocity command issued.
- `EMERGENCY_STOP`: Immediate asynchronous hardware halt.
- `SAFETY_ALERT`: Warning or critical anomaly broadcast.

### Robot Mobility

- `ROBOT_STATE`: Odometry, heading, and battery telemetry.
- `ROBOT_COMMAND_REQUESTED`, `ROBOT_COMMAND_APPROVED`, `ROBOT_COMMAND_BLOCKED`, `ROBOT_COMMAND_SENT`, `ROBOT_COMMAND_ACK`, `ROBOT_COMMAND_FAILED`

---

## 4. In-Memory Event Dispatcher

The local Control Station maintains an in-process, bounded event dispatcher (`EventDispatcher`) providing:

1. **Monotonic Sequence Indexing**: Guarantees deterministic order reconstruction during replay.
2. **Wildcard & Targeted Subscriptions**: Pub/sub listener hooks for local components and WebSocket distribution.
3. **Ring Buffer Storage**: Bounded local history (default 1,000 events) for UI timeline hydration.
