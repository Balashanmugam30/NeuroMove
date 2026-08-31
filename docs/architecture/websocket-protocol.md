# NeuroMove WebSocket Wire Protocol Specification

**Protocol Version**: `1.0`  
**Schema Version**: `1.0.0`

## 1. Message Frame Envelope

All messages transmitted between the NeuroMove Control Station and clients conform to the `TransportMessage` JSON schema:

```json
{
  "type": "WELCOME | HELLO | PING | PONG | SUBSCRIBE | UNSUBSCRIBE | EVENT | SNAPSHOT | RESET | ERROR",
  "stream": "live | eeg | robot | safety | all",
  "transport_seq": 42,
  "timestamp": "2026-08-31T16:30:00.000000Z",
  "event": { /* Canonical EventEnvelope if type == "EVENT" */ },
  "payload": { /* Typed payload dictionary */ }
}
```

---

## 2. Connection Lifecycle & Handshake

### Step 1: Server Welcome
Immediately upon accepting a TCP WebSocket connection, the server sends a `WELCOME` message:

```json
{
  "type": "WELCOME",
  "timestamp": "2026-08-31T16:30:00.000000Z",
  "payload": {
    "protocol_version": "1.0",
    "schema_version": "1.0.0",
    "server_version": "0.1.0",
    "mode": "SIMULATION",
    "connection_id": "conn_a7f9b8c2d1e0",
    "available_streams": ["live", "eeg", "robot", "safety", "all"],
    "heartbeat_interval_ms": 5000,
    "heartbeat_timeout_ms": 3000
  }
}
```

### Step 2: Immediate State Snapshot
Followed immediately by a `SNAPSHOT` message containing the latest authoritative system state at canonical sequence $N$:

```json
{
  "type": "SNAPSHOT",
  "timestamp": "2026-08-31T16:30:00.000000Z",
  "payload": {
    "mode": "SIMULATION",
    "server_time": "2026-08-31T16:30:00.000000Z",
    "latest_event_sequence": 142,
    "active_session": null,
    "active_trial": null,
    "robot_state": { "heading_deg": 0.0, "linear_velocity_mps": 0.0 },
    "safety_state": { "runtime_state": "IDLE", "last_decision": "STOP" }
  }
}
```

### Step 3: Client Hello
The client acknowledges with its metadata and requested streams:

```json
{
  "type": "HELLO",
  "timestamp": "2026-08-31T16:30:00.050000Z",
  "payload": {
    "client_id": "client_web_78a1bc",
    "client_name": "NeuroMove Web Command Center",
    "client_version": "0.1.0",
    "requested_streams": ["live", "robot", "safety", "eeg"]
  }
}
```

---

## 3. Heartbeat & Latency Verification

1. **Server Ping**: Every `5000ms`, server issues a `PING` frame.
2. **Client Pong**: Client replies with a `PONG` containing client timestamp and sequence number.
3. **Heartbeat Timeout**: If 3 consecutive pings go unanswered, the server marks the client connection `DEGRADED`, and subsequently terminates the socket to free resources.

---

## 4. Sequence Numbers & Gap Detection

- `EventEnvelope.sequence`: Monotonically increasing canonical domain event sequence (authoritative for state transitions).
- `TransportMessage.transport_seq`: Monotonically increasing transport packet sequence per connection session.
- If a client detects `transport_seq > highest_seen + 1`, a gap has occurred (e.g. dropped packet during network throttling). The client logs the gap metric and requests an updated `SNAPSHOT` message.
