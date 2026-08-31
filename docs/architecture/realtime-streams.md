# NeuroMove Real-Time Streams Architecture

## 1. WebSocket Streaming Endpoints

The NeuroMove control station exposes high-throughput WebSocket streaming pathways:

| Path | Protocol / Format | Payload Type | Description |
| :--- | :--- | :--- | :--- |
| `/ws/live` | JSON `EventEnvelope` | Canonical Events | Monotonically sequenced live audit stream of predictions, intent confirmation, and arbitration events. |
| `/ws/eeg` | JSON `EEGChunk` | Multi-channel Samples | High-frequency chunked continuous raw potential values ($C_3, C_z, C_4$) @ 250 Hz with signal quality. |
| `/ws/robot` | JSON `RobotStatePayload` | Odometry & Kinematics | Differential drive heading, linear/angular velocity, motor PWM, and proximity telemetry. |
| `/ws/safety` | JSON `SafetyDecisionPayload` | Safety State Machine | Instant emergency halts, boundary violations, and risk alerts. |

---

## 2. Event Envelope Transport

All `/ws/live` messages are wrapped in the universal canonical `EventEnvelope`:

```json
{
  "event_id": "evt_01J...",
  "schema_version": "1.0.0",
  "timestamp": "2026-08-31T10:00:00Z",
  "occurred_at": "2026-08-31T10:00:00Z",
  "mode": "SIMULATION",
  "event_type": "PREDICTION",
  "session_id": "ses_sim_42_right-turn",
  "sequence": 42,
  "payload": {
    "intent": "RIGHT",
    "class_probabilities": {
      "RIGHT": 0.92,
      "LEFT": 0.03,
      "FORWARD": 0.03,
      "NONE": 0.02
    },
    "neural_confidence": 0.92,
    "model_id": "simulator.synthetic-decoder",
    "model_version": "1.0.0"
  }
}
```
