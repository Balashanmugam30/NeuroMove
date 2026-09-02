# Hardware Link Faults, Fail-Closed Heartbeats & Recovery

## 1. Fail-Closed Heartbeat Health Policy

Heartbeats are monitored periodically by the `HeartbeatMonitor`:

$$\text{Missed Count} \ge 2 \implies \text{DEGRADED} \implies \text{Command Gating Active}$$
$$\text{Missed Count} \ge 3 \implies \text{STALE} \implies \text{Execution Blocked}$$

When in `DEGRADED` or `STALE` state:
- New `EXECUTE_INTENT` commands are rejected.
- Only recovery pings and safe stop signals are dispatched.

---

## 2. Cold Reboot & Session Reconciliation

Upon device reboot:
1. `boot_id` changes (e.g. `boot_01` $\to$ `boot_02`).
2. Current `HardwareSession` is marked `TERMINATED`.
3. In-flight unacknowledged commands are marked `UNKNOWN` (never silently assumed completed or replayed).
4. A new `HardwareSession` is created with fresh monotonic sequence tracking.
5. Capabilities and protocol version are renegotiated before new commands are accepted.
