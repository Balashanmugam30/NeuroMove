# Intent Events & Phase 17 Handoff Contract

## 1. Canonical Intent Event Specifications

All intent events reuse NeuroMove's canonical `EventEnvelope` and are routed to both the `live` and `intent` WebSocket streams:

- `INTENT_CANDIDATE`: Dispatched when an unconfirmed predictive window satisfies candidate threshold.
- `INTENT_CONFIRMED`: Dispatched when Phase 15 temporal evidence is accepted as confirmed.
- `INTENT_ACTIVATED`: Dispatched when an intent enters the `ACTIVE` canonical state.
- `INTENT_CANCELLED`: Dispatched on explicit operator or rest cancellation.
- `INTENT_EXPIRED`: Dispatched when candidate or active deadlines elapse.
- `INTENT_INTERRUPTED`: Dispatched on context switch or stream interruption.
- `INTENT_COMPLETED`: Dispatched on successful lifecycle conclusion.
- `INTENT_REPLACEMENT_REQUESTED`: Dispatched during cross-class replacement negotiation.
- `INTENT_STATE_CHANGED`: Dispatched on state transitions.
- `INTENT_CONTEXT_RESET`: Dispatched when the engine resets to `NO_INTENT`.

---

## 2. Phase 17 Safety Arbitration Handoff Contract

At the conclusion of Phase 16, the system exposes the **`IntentStateSnapshot`** consumed by Phase 17 Safety Arbitration:

```typescript
export interface IntentStateSnapshot {
  snapshot_id: string;
  active_intent_id: string | null;
  current_state: IntentLifecycleState;
  intent_class: string | null;
  subject_id?: string | null;
  session_id?: string | null;
  model_version_id: string | null;
  confidence_score?: number | null;
  confidence_evaluation_id?: string | null;
  temporal_confirmation_id?: string | null;
  created_at: string;
  updated_at: string;
  state_deadline?: number | null;
  transition_reason: IntentTransitionReason;
  policy_version: string;
  transition_count: number;
}
```

Phase 17 will independently arbitrate whether an `ACTIVE` intent in this snapshot is permitted to proceed under physical safety rules, collision avoidance, and velocity limits. Phase 16 performs none of those checks.
