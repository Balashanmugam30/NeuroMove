# NeuroMove Architecture — Fault Injection & Taxonomy

## 1. Fault Taxonomy

Phase 18 classifies faults across 10 top-level categories:

| Category | Description | Primary Fault Types |
| :--- | :--- | :--- |
| **TRANSPORT** | Telemetry and message delivery issues | `STREAM_DISCONNECT`, `STREAM_DELAY`, `STREAM_EVENT_DROP`, `STREAM_EVENT_DUPLICATE`, `STREAM_EVENT_REORDER`, `STREAM_SEQUENCE_GAP`, `WEBSOCKET_DISCONNECT` |
| **DATA** | Structural and value corruptions | `MALFORMED_PAYLOAD`, `MISSING_FIELD`, `INVALID_TIMESTAMP`, `STALE_DATA`, `CORRUPTED_FEATURES`, `EMPTY_SAMPLE` |
| **MODEL** | Machine learning decoding outages | `MODEL_UNAVAILABLE`, `MODEL_VERSION_MISMATCH`, `MODEL_ROLLBACK`, `MODEL_CORRUPTION_SIMULATED`, `CALIBRATION_UNAVAILABLE` |
| **CONFIDENCE** | Statistical uncertainty estimation failures | `CONFIDENCE_SERVICE_UNAVAILABLE`, `CONFIDENCE_OUTPUT_MISSING`, `CONFIDENCE_STALE`, `TEMPORAL_STATE_RESET` |
| **INTENT** | State machine lifecycle perturbations | `INTENT_SERVICE_UNAVAILABLE`, `INTENT_SNAPSHOT_MISSING`, `INTENT_EVENT_DUPLICATE`, `INTENT_EVENT_OUT_OF_ORDER`, `INTENT_STATE_CORRUPTION_SIMULATED` |
| **SAFETY** | Arbitration gate outages | `SAFETY_SERVICE_UNAVAILABLE`, `SAFETY_CONTEXT_UNKNOWN`, `SAFETY_POLICY_UNAVAILABLE`, `SAFETY_EVALUATION_TIMEOUT` |
| **PERSISTENCE** | Storage and database failures | `DATABASE_UNAVAILABLE`, `DATABASE_WRITE_FAILURE`, `DATABASE_READ_FAILURE`, `TRANSACTION_ROLLBACK`, `SNAPSHOT_UNAVAILABLE` |
| **SERVICE** | Subsystem availability and latency | `SERVICE_RESTART`, `SERVICE_TIMEOUT`, `SERVICE_LATENCY`, `DEPENDENCY_UNAVAILABLE` |
| **TIMING** | Clock anomalies and temporal skew | `CLOCK_SKEW_SIMULATED`, `TIMESTAMP_DELAY`, `EVENT_DELAY`, `TIMEOUT_ACCELERATION` |
| **CONTEXT** | Boundary switches and metadata drift | `SUBJECT_SWITCH`, `SESSION_SWITCH`, `MODEL_CONTEXT_SWITCH`, `ENVIRONMENT_CONTEXT_LOSS` |

---

## 2. Fault Parameterization & Security Boundaries

All injected faults require bounded, validated parameters:
- `delay_ms`: Bounded between $[0, 60000]\text{ms}$.
- `drop_count`: Bounded between $[1, 100]$ events.
- `duplicate_count`: Bounded between $[1, 100]$ events.
- `reorder_offset`: Bounded between $[1, 50]$ positions.
- `clock_skew_ms`: Bounded between $[-86400000, 86400000]\text{ms}$.

### Security Rule
No fault injection API accepts arbitrary code execution, shell commands, or arbitrary filesystem paths. All faults operate through strongly typed domain models and validated hooks.

---

## 3. Scopes & Deterministic Triggers

Faults operate under explicit scopes:
- `SINGLE_EVENT`: Injected on the next qualifying event only.
- `WINDOW`: Injected over a specified time or sequence window.
- `SESSION`: Bound to a specific subject/session ID.
- `SERVICE`: Affects calls to a specific backend service.
- `GLOBAL_SIMULATION`: Active across the simulated test harness.

Activation triggers:
- `MANUAL`: Immediately active upon injection.
- `AFTER_N_EVENTS`: Triggers after $N$ events have passed.
- `AT_SEQUENCE`: Triggers when event sequence number matches $S$.
- `AT_TIMESTAMP`: Triggers at simulated timestamp $T$.
