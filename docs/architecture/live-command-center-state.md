# Live Command Center — State Synchronization & Data Flow

## 1. Dual-Channel Ingestion Model

```
       HTTP / REST                           WebSocket Local IPC
(Commands & Snapshots)                       (High-Frequency Telemetry)
         │                                               │
         ▼                                               ▼
 fetchSimulationStatus()                       ws://127.0.0.1:8000/ws/stream
 fetchSystemStatus()                           ├── /live
 startSimulation()                             ├── /robot
 triggerEmergencyStop()                        ├── /safety
         │                                     └── /eeg
         │                                               │
         └─────────────► React Component ◄───────────────┘
                     (Authoritative Backend Truth)
```

1. **HTTP Endpoints**:
   - `/api/simulation/start`, `/pause`, `/resume`, `/stop`, `/reset`, `/speed`
   - `/api/safety/emergency-stop`
   - `/api/status`, `/api/simulation/status`
2. **WebSocket Streams**:
   - `/live`: High-level simulation status, intent predictions, and safety decisions.
   - `/robot`: Continuous differential drive odometry (heading, velocity, battery, PWM).
   - `/safety`: State machine transitions and arbitration verdicts.
   - `/eeg`: High-frequency 250 Hz sample stream ring buffers.

---

## 2. Event Envelope Ingestion
All inbound WebSocket events conform to `EventEnvelope<T>` from `@neuromove/contracts`. The frontend absorbs events via `useRealtimeEvents` with:
- Monotonic sequence numbering
- Deduplication via `event_id:sequence` keys
- Capped memory ring buffer (50 most recent events)
- Interactive payload inspection
