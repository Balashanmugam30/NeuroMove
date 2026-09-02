# Device Lifecycle, State Machine & Session Management

## 1. Hardware Connection State Machine

The connection lifecycle is governed by the `HardwareConnectionStateMachine`, strictly validating state transitions:

```
[DISCONNECTED] ───────────────> [DISCOVERING]
       │                              │
       │                              v
       └───────────────────────> [CONNECTING]
                                      │
                                      v
                                [NEGOTIATING]
                                      │
                                      v
   [DEGRADED] <─────────────── [READY / CONNECTED]
       │                              │
       v                              v
    [STALE] ───────────────────> [RECONNECTING]
                                      │
                                      v
                                   [ERROR]
```

### Transition Invariants:
- `DISCONNECTED` $\to$ `READY` is **prohibited**. Negotiation must occur first.
- Reconnection requires establishing a new session (`HardwareSession`) and resynchronizing sequence baselines.
- Boot ID changes trigger cold reboot recovery, invalidating old sessions.

---

## 2. Protocol Handshake & Capability Negotiation

1. **Protocol Handshake**: Host transmits client version (`1.0`) and unique session ID.
2. **Device Identity Validation**: Device returns `boot_id`, `firmware_version`, `hardware_revision`, and `capabilities`.
3. **Capability Matching**: Verifies advertised capabilities match the HIL profile (`COMMAND_RECEIVE`, `SAFE_STOP`, `HEARTBEAT`, `STATUS_REPORT`, `HIL_ONLY`).
