# NeuroMove Backpressure & Bounded Buffering Policy

## 1. Safety-Critical Principle

In a real-time BCI mobility system, unconstrained asynchronous queues lead to memory leaks, GC pauses, latency build-up, and potentially dangerous actuation delays.

NeuroMove enforces strict **bounded memory** and **channel-specific backpressure policies** at both the Python server layer and the frontend client.

---

## 2. Server Queue Policies (`ClientConnection`)

Each active WebSocket client session possesses a private, bounded asynchronous queue:
- **Maximum Queue Size**: 200 messages.

When the queue capacity is reached (`qsize >= max_queue_size`), incoming messages are handled according to stream classification:

```
                  +--------------------------+
                  |  Message to Enqueue      |
                  +-------------+------------+
                                |
                                v
                   [ Queue full (>= 200)? ]
                    /                    \
              (Yes)/                      \(No)
                  v                        v
        [ Stream Type Check ]       [ Enqueue normally ]
         /        |        \
        /         |         \
 (eeg) v  (robot) v   (safety / session) v
+------------+ +------------+ +----------------------+
| Drop chunk | | Coalesce / | | Mark client DEGRADED |
| Increment  | | Drop old   | | Enqueue with high    |
| dropped    | | state      | | priority             |
+------------+ +------------+ +----------------------+
```

### Stream Specific Semantics:
1. **High-Frequency Electrophysiology (`eeg`)**:
   - Chunks represent streaming timeseries. If client consumption stalls, drop the newest incoming chunk immediately and increment `events_dropped`.
   - *Rationale*: A delayed EEG chunk is biologically stale and useless for real-time BCI decoding.

2. **State Telemetry (`robot`, `obstacle`)**:
   - Coalesce by discarding previous unconsumed state frames in favor of newer telemetry.

3. **Life-Cycle & Safety Alerts (`SAFETY_ALERT`, `EMERGENCY_STOP`, `SESSION_*`)**:
   - Never dropped silently. Placed in queue and client state transitions to `DEGRADED`.

---

## 3. Frontend Circular Memory (`EEGRingBuffer`)

To protect React rendering performance from 25–50 Hz WebSocket event thrashing:
- Raw chunks are ingested directly into an in-memory `EEGRingBuffer` instantiated with pre-allocated `Float32Array` buffers (1000 samples $\approx 4\text{s}$ at $250\text{ Hz}$).
- Memory overhead is completely static and bounded.
- The HTML5 Canvas oscilloscope queries the buffer on the browser's native `requestAnimationFrame` loop (60 FPS), achieving smooth waveform rendering without triggering React virtual DOM diffing cycles.
