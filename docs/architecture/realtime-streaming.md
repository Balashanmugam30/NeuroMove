# NeuroMove Real-Time Streaming Architecture

## 1. Executive Summary

The NeuroMove Real-Time Streaming subsystem establishes a low-latency, deterministic, and resilient telemetry pipeline connecting the local FastAPI Control Station core to the Next.js Web Command Center.

Designed for research-grade Brain-Computer Interface (BCI) mobility platforms, the architecture ensures:
1. **Operating Mode Transparency**: Strict runtime separation between `SIMULATION`, `REPLAY`, and `LIVE` streams.
2. **Deterministic Sequence Guarantees**: Canonical event sequences ($N \to N+1$) coupled with per-connection monotonic transport sequence numbers for gap detection.
3. **Bounded Memory & Backpressure Safety**: Zero unbounded arrays, circular ring buffers for high-frequency electrophysiology, and selective drop semantics under queue saturation.
4. **Local Air-Gapped Operation**: Sub-2ms local loopback IPC latency with zero reliance on external cloud services for the safety loop.

---

## 2. End-to-End Pipeline

```
+-----------------------------------------------------------------------------------+
|                           LOCAL CONTROL STATION CORE                              |
|                                                                                   |
|  +---------------------------+       +-----------------------------------------+  |
|  | Synthetic EEG Generator   |       | Deterministic Simulation Runner / Engine|  |
|  | (250 Hz, C3/Cz/C4 Waves)  |       | (Scenarios, Cue Timings, Obstacles)     |  |
|  +-------------+-------------+       +--------------------+--------------------+  |
|                |                                          |                       |
|         (Raw EEG Chunks)                           (Domain Events)                |
|                |                                          |                       |
|                v                                          v                       |
|  +---------------------------+       +-----------------------------------------+  |
|  | StreamRouter (EEG Chunk)  |       | Canonical EventDispatcher               |  |
|  +-------------+-------------+       +--------------------+--------------------+  |
|                |                                          |                       |
|                |                   (Subscribed Events)    |                       |
|                +-----------------+------------------------+                       |
|                                  |                                                |
|                                  v                                                |
|                     +---------------------------+                                 |
|                     | LatestValueCache (Atomic) |                                 |
|                     +-------------+-------------+                                 |
|                                   |                                               |
|                                   v                                               |
|                     +---------------------------+                                 |
|                     | ClientConnection Queue    |                                 |
|                     | (Bounded maxsize=200)     |                                 |
|                     +-------------+-------------+                                 |
+-----------------------------------|-----------------------------------------------+
                                    | (WebSocket Wire JSON Protocol)
                                    v
+-----------------------------------------------------------------------------------+
|                        NEXT.JS WEB COMMAND CENTER                                 |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | RealtimeClient (Handshake, PING/PONG, Exponential Jitter Reconnect, Gaps)   |  |
|  +-------------------+------------------------------------+--------------------+  |
|                      |                                    |                       |
|           (High-Frequency EEG)                     (State / Events)               |
|                      |                                    |                       |
|                      v                                    v                       |
|          +-----------------------+              +-------------------+             |
|          | EEGRingBuffer         |              | RealtimeProvider  |             |
|          | (Float32Array [1000]) |              | (React Context)   |             |
|          +-----------+-----------+              +---------+---------+             |
|                      |                                    |                       |
|                      v (requestAnimationFrame 60 FPS)     v (Hooks)               |
|          +-----------------------+              +-------------------+             |
|          | EEGOscilloscope HTML5 |              | Live Dashboard    |             |
|          | Canvas Trace Render   |              | Twin / Timeline   |             |
|          +-----------------------+              +-------------------+             |
+-----------------------------------------------------------------------------------+
```

---

## 3. Dedicated Stream Channels

Clients may subscribe to individual channels or all channels via `/ws/stream`:

| Stream Path | Channel | Target Payload | Ingestion Cadence | Backpressure Policy |
| :--- | :--- | :--- | :--- | :--- |
| `/ws/live` | `live` | Monotonic canonical domain events, predictions, decisions | $\approx 2\text{--}10\text{ Hz}$ | Reliable Queueing + Coalesce |
| `/ws/eeg` | `eeg` | Synthetic 3-channel timeseries chunks (10 samples/chunk) | $25\text{ Hz}$ | Bounded Ring Buffer + Drop Oldest |
| `/ws/robot` | `robot` | Robot odometry, heading, velocity, motor PWM | $\approx 10\text{ Hz}$ | Latest-Value Coalescing |
| `/ws/safety`| `safety`| Safety transitions, emergency stops, alerts | Asynchronous | High-Priority Reliable Queueing |
| `/ws/stream`| `all` | Multiplexed stream carrying all selected channels | Dynamic | Channel-Specific Policies |
