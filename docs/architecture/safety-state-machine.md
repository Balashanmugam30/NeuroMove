# Safety State Machine, Precedence Hierarchy & Recovery Lifecycle

## 1. Canonical State Definitions

The Safety Arbitration State Machine operates across 8 deterministic finite states:

```mermaid
stateDiagram-v2
    [*] --> SAFE_IDLE
    SAFE_IDLE --> EVALUATING: EVALUATION_START
    SAFE_IDLE --> EMERGENCY_STOP: ASSERT_EMERGENCY_STOP
    SAFE_IDLE --> LOCKED_OUT: ASSERT_LOCKOUT

    EVALUATING --> AUTHORIZED: DECISION_AUTHORIZED
    EVALUATING --> HELD: DECISION_HELD
    EVALUATING --> DENIED: DECISION_DENIED
    EVALUATING --> EMERGENCY_STOP: DECISION_EMERGENCY_STOP
    EVALUATING --> LOCKED_OUT: DECISION_LOCKED_OUT

    AUTHORIZED --> SAFE_IDLE: EXPIRE_OR_COMPLETE
    AUTHORIZED --> HELD: OPERATOR_HOLD
    AUTHORIZED --> DENIED: REVOCATION
    AUTHORIZED --> EMERGENCY_STOP: ASSERT_EMERGENCY_STOP
    AUTHORIZED --> LOCKED_OUT: ASSERT_LOCKOUT

    HELD --> EVALUATING: RE_EVALUATE
    HELD --> SAFE_IDLE: HOLD_RELEASED
    HELD --> EMERGENCY_STOP: ASSERT_EMERGENCY_STOP
    HELD --> LOCKED_OUT: ASSERT_LOCKOUT

    DENIED --> EVALUATING: FRESH_INTENT
    DENIED --> SAFE_IDLE: RESET
    DENIED --> EMERGENCY_STOP: ASSERT_EMERGENCY_STOP
    DENIED --> LOCKED_OUT: THRESHOLD_EXCEEDED

    EMERGENCY_STOP --> RESET_PENDING: CLEAR_EMERGENCY_STOP
    LOCKED_OUT --> RESET_PENDING: UNLOCK_PROCEDURE

    RESET_PENDING --> SAFE_IDLE: RESET_SUCCESS (Preconditions Met)
    RESET_PENDING --> LOCKED_OUT: RESET_FAILURE (Precondition Failed)
    RESET_PENDING --> EMERGENCY_STOP: RE_ASSERT_E_STOP
```

---

## 2. Precedence Hierarchy

When multiple safety constraints or violations occur simultaneously, the arbiter evaluates rules against an explicit, immutable precedence hierarchy:

| Rank | Category | Canonical Decision | Target State | Description |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `EMERGENCY_STOP` | `EMERGENCY_STOP` | `EMERGENCY_STOP` | Software E-stop dominates all other conditions. |
| **2** | `LOCKED_OUT` | `LOCKED_OUT` | `LOCKED_OUT` | Threshold violation lockout blocks all operations. |
| **3** | `MALFORMED_INPUT` | `INVALID` | `DENIED` | Missing or malformed intent payload. |
| **4** | `CRITICAL_HEALTH` | `DENIED` | `DENIED` | Core service degraded or reporting unknown health. |
| **5** | `HARD_CONSTRAINT` | `DENIED` | `DENIED` | Eligibility, blocked class, rate, or duration violation. |
| **6** | `CONTEXT_STALE` | `DENIED` | `DENIED` | Stale timestamps, stream disconnected, or model mismatch. |
| **7** | `OPERATOR_HOLD` | `HELD` | `HELD` | Active manual operator pause. |
| **8** | `TEMPORARY_HOLD` | `HELD` | `HELD` | Transient cooldown or context preparation. |
| **9** | `ALL_GATES_PASS` | `AUTHORIZED` | `AUTHORIZED` | Unanimous pass across all 13 rules. |

---

## 3. Fail-Closed Recovery & Startup Behavior

- **Database-Backed Startup Invariant**:
  If the previous process shutdown or crashed while in `EMERGENCY_STOP` or `LOCKED_OUT`, `SafetyStorage.recover_state_on_startup()` automatically restores the restrictive state upon restart. A server reboot never clears an emergency stop or lockout!
- **Clear Procedure Invariant**:
  Clearing an emergency stop or unlocking a lockout transitions strictly to `RESET_PENDING`. It **never** auto-authorizes. A verified reset sequence is mandatory to reach `SAFE_IDLE`, and a fresh evaluation must run to reach `AUTHORIZED`.
