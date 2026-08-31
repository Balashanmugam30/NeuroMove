# NeuroMove Frontend Real-Time Architecture

## 1. Component Overview

The frontend real-time transport client (`apps/web/lib/realtime/`) manages client WebSocket connectivity with auto-reconnection, protocol validation, channel multiplexing, and state distribution.

```
RealtimeClient (Singleton WebSocket Worker)
      │
      ├─► Protocol Handshake (HELLO -> WELCOME)
      ├─► Heartbeat Monitor (PING / PONG, Latency Calculation)
      ├─► Reconnection Engine (Exponential Backoff + Jitter)
      ├─► Gap Detector (transport_seq tracking)
      ├─► Deduplication Filter (LRU Cache of event_id:sequence)
      │
      ▼
RealtimeProvider (React Context Provider)
      │
      ├─► useRealtime() (Connection State, Latency, Operating Mode)
      ├─► useRealtimeStream(channel) (Channel Subscriptions)
      └─► useRealtimeEvents() (Canonical Event Log Stream)
```

---

## 2. Reconnect Backoff with Randomized Jitter

When a connection is severed unexpectedly, `RealtimeClient` initiates an exponential backoff reconnect schedule:

$$\text{delay} = \min(\text{maxDelay}, \text{baseDelay} \times 1.5^{\text{attempts}}) + \text{jitter}$$

where $\text{jitter} \in [-0.2 \times \text{delay}, +0.2 \times \text{delay}]$.

This prevents thundering herd reconnection storms on local restart.

---

## 3. Data Freshness Heuristics

The `getFreshness()` indicator categorizes connection health based on the time elapsed since the most recent message:

- **`FRESH`**: Last message received $\le 2000\text{ ms}$.
- **`STALE`**: Last message received $> 2000\text{ ms}$ and connection still open.
- **`DISCONNECTED`**: Socket closed or reconnecting.
