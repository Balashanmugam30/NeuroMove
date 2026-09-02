# NeuroMove Architecture — Formal Resilience Invariants

## 1. The 14 Platform Invariants

Phase 18 implements an automated `InvariantEngine` that inspects the system after every fault and recovery step:

| Invariant ID | Name | Severity | Certification Requirement |
| :--- | :--- | :--- | :--- |
| `INV_01` | **NO_ACCIDENTAL_AUTHORIZATION** | CRITICAL | Faults/degraded state strictly yield `NOT AUTHORIZED`. |
| `INV_02` | **NO_DUPLICATE_ACTIVE_INTENT** | HIGH | Duplicate events never create $>1$ concurrent active intent. |
| `INV_03` | **NO_TERMINAL_STATE_MUTATION** | HIGH | `COMPLETED`, `CANCELLED`, `EXPIRED`, `INTERRUPTED` never mutate in place. |
| `INV_04` | **NO_SUBJECT_BOUNDARY_LEAK** | HIGH | Subject context switch blocks in-flight intents from execution. |
| `INV_05` | **NO_SESSION_BOUNDARY_LEAK** | HIGH | Cross-session intent injection strictly rejected. |
| `INV_06` | **NO_MODEL_BOUNDARY_LEAK** | HIGH | Rolled-back or unregistered decoders cannot authorize execution. |
| `INV_07` | **NO_STALE_AUTHORIZATION** | HIGH | Timestamp age $>500\text{ms}$ strictly denied. |
| `INV_08` | **NO_UNKNOWN_TO_ALLOW** | CRITICAL | Missing or unknown health status strictly fails closed to `DENIED`/`HELD`. |
| `INV_09` | **NO_ESTOP_BYPASS** | CRITICAL | Emergency stop persists across subsequent events and restarts. |
| `INV_10` | **NO_LOCKOUT_BYPASS** | CRITICAL | Lockout persists across repeated attempts until administrative unlock. |
| `INV_11` | **NO_DUPLICATE_EVENT_MUTATION** | MEDIUM | Duplicate `source_event_id` is processed idempotently. |
| `INV_12` | **NO_OUT_OF_ORDER_STATE_REGRESSION** | HIGH | Out-of-order events do not cause backward state regressions. |
| `INV_13` | **NO_AUTHORIZATION_AFTER_UNVERIFIED_RESET** | CRITICAL | Clearing E-stop/lockout requires verified reset before `SAFE_IDLE`. |
| `INV_14` | **NO_UNCONTAINED_CASCADE** | HIGH | UI or transport failures do not corrupt backend safety state. |

---

## 2. Fail-Closed Certification

An experiment produces `FAIL_CLOSED_PASS` if and only if:
1. All evaluated invariants yield `InvariantStatus.PASS`.
2. `authorization_during_failure == False`.
3. Recovery correctly restores safe operational state or locks out safely.
