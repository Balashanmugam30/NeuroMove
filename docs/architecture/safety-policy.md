# Safety Policy Configuration, Parameters & Constraints

## 1. Versioned Policy Architecture

Safety arbitration policies are immutable, versioned data contracts defining strict operational limits and gating conditions. Every policy is identified by `policy_id`, `version`, and a cryptographic SHA-256 parameter checksum.

```
SafetyPolicy
├── policy_id: "pol_safety_v1"
├── version: "1.0.0"
├── allowlisted_intents: ["LEFT", "RIGHT", "FORWARD", "BACKWARD"]
├── blocked_intents: ["REST", "STOP", "NONE", "UNCERTAIN"]
├── max_intent_age_ms: 500.0
├── max_evaluation_age_ms: 300.0
├── max_context_age_ms: 1000.0
├── max_authorized_duration_ms: 2000.0
├── maximum_command_rate: 5
├── rate_window_ms: 1000.0
├── minimum_command_gap_ms: 100.0
├── critical_health_requirements: ["backend", "database", "event_dispatcher", "model_service", "intent_service"]
├── operator_hold_enabled: true
├── emergency_stop_enabled: true
├── lockout_threshold: 3
├── lockout_policy: "REQUIRE_MANUAL_RESET"
├── reset_requirements: ["HEALTH_OK", "NO_E_STOP", "NO_LOCKOUT", "VALID_CONTEXT"]
├── created_at: ISO8601
└── checksum: SHA-256 (16-char prefix)
```

---

## 2. Hard Safety Constraints

### A. Intent Allowlist / Blocklist
- `allowlisted_intents`: The explicit set of directional motor-imagery intents permitted to seek execution authorization.
- `blocked_intents`: Explicitly rejected intents (e.g. `REST`, `STOP`, `NONE`, `UNCERTAIN`). Any blocked intent yields immediate `DENIED` with reason code `INTENT_CLASS_BLOCKED`.

### B. Temporal Freshness Gates
- `max_intent_age_ms` ($500\text{ms}$): If the elapsed time since intent creation exceeds this boundary, arbitration rejects the candidate as `INTENT_STALE`.
- `max_context_age_ms` ($1000\text{ms}$): Telemetry and stream context must be actively refreshed.

### C. Command Rate Limiting & Inter-Command Gap
- Evaluates a sliding time window ($\tau = 1000\text{ms}$).
- If more than `maximum_command_rate` ($5$) authorizations occur within the window, subsequent requests are blocked with `COMMAND_RATE_EXCEEDED`.
- If two successive authorizations occur within `minimum_command_gap_ms` ($100\text{ms}$), the candidate is blocked with `MINIMUM_GAP_VIOLATED`.

### D. Continuous Active Duration Limit
- To prevent continuous unmonitored command authorization, continuous active state is capped at `max_authorized_duration_ms` ($2000\text{ms}$). Beyond this limit, authorization is revoked with `MAX_DURATION_EXCEEDED`.
