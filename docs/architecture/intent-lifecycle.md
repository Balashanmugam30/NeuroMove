# Canonical Intent Lifecycle & Transition Policy

## 1. Intent Lifecycle States & Semantics

| State | Semantic Meaning | Constraints / Invariants |
| :--- | :--- | :--- |
| `NO_INTENT` | No candidate or active intent exists. | `active_intent_id = None` |
| `CANDIDATE` | A potential intent exists from a valid prediction, awaiting temporal confirmation. | Governed by `candidate_timeout_ms` ($1000\text{ms}$). |
| `CONFIRMED` | Phase 15 temporal confirmation has been authoritatively accepted. | Semantic state ready for activation. Governed by `confirmation_acceptance_window_ms` ($500\text{ms}$). |
| `ACTIVE` | Canonical current intent of the BCI system. | Governed by `active_intent_timeout_ms` ($2000\text{ms}$). Does **NOT** imply safe to actuate. |
| `REPLACEMENT_PENDING`| A new confirmed intent is competing with an existing active intent. | Deterministic cross-class resolution in progress. |
| `COMPLETED` | Software intent lifecycle concluded normally. | Terminal state. Immutable record. |
| `CANCELLED` | Explicitly cancelled by operator or non-directional rest cue. | Terminal state. Immutable record. |
| `EXPIRED` | Non-terminal state exceeded its deadline without downstream progression. | Terminal state. Immutable record. |
| `INTERRUPTED` | Lifecycle terminated prematurely due to context switch (subject/session/model) or stream fault. | Terminal state. Immutable record. |

---

## 2. Policy Configuration Parameters

All lifecycle policies are versioned, checksummed, and persisted in `intent_policies`:

```json
{
  "policy_id": "default_intent_policy",
  "version": "v1.0.0",
  "candidate_timeout_ms": 1000.0,
  "confirmation_acceptance_window_ms": 500.0,
  "active_intent_timeout_ms": 2000.0,
  "allow_replacement": true,
  "replacement_requires_confirmation": true,
  "same_class_reconfirmation_cooldown_ms": 1000.0,
  "cross_class_replacement_policy": "REQUIRE_CONFIRMATION",
  "subject_change_policy": "INTERRUPT_AND_RESET",
  "session_change_policy": "INTERRUPT_AND_RESET",
  "model_change_policy": "INTERRUPT_AND_RESET",
  "rest_handling_policy": "CANCEL_CANDIDATE"
}
```

---

## 3. Same-Class Reconfirmation & Cooldown

When an active intent (e.g. `LEFT_IMAGERY`) receives a subsequent confirmed prediction for the exact same class:
- If $\Delta t < \text{cooldown\_ms}$ ($1000\text{ms}$): The incoming confirmation is suppressed as an idempotent duplicate without allocating new intent identities.
- If $\Delta t \ge \text{cooldown\_ms}$: The active intent deadline is renewed or promoted through a fresh cycle according to policy.

## 4. Cross-Class Replacement

When an active intent (e.g. `LEFT_IMAGERY`) receives a confirmed prediction for an opposing class (e.g. `RIGHT_IMAGERY`):
- If `allow_replacement == true`: The active intent transitions to `REPLACEMENT_PENDING` and is retired, while the new class receives a new `intent_id` and is promoted to `ACTIVE`.
- Lineage is preserved in `intent_state_transitions`.
