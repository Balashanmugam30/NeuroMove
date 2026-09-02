# NeuroMove — Product Session & Cross-Subsystem Lineage

## 1. Executive Summary

The `ProductSession` model is the top-level entity that bridges all underlying subsystem sessions across Phases 01–23 without duplicating raw sensor samples or database rows.

---

## 2. Product Session Schema & Entity Model

```json
{
  "session_id": "prod_sess_48a9f210",
  "title": "NeuroMove Competition Product Session",
  "subject_id": "SUBJ_PILOT_01",
  "source_type": "SIMULATOR",
  "status": "ACTIVE",
  "acquisition_session_id": "acq_sess_9a81bc20",
  "sensor_session_id": "sensor_sess_3c72e18a",
  "model_version": "csp_lda_v2.4",
  "confidence_policy": "STRICT_RESEARCH_FUSION",
  "intent_id": "intent_7f10a82b",
  "safety_decision": "AUTHORIZED",
  "hil_session_id": "hil_sess_6d20f91c",
  "experiment_id": "exp_820c41de",
  "manifest_hash": "mnf_48a9f2",
  "provenance_hash": "b81c4e789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "created_at": "2026-09-02T12:00:00Z",
  "updated_at": "2026-09-02T12:00:00Z"
}
```

---

## 3. Subsystem Lineage Mapping

```
                 ┌────────────────────────────────┐
                 │         ProductSession         │
                 └───────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Acquisition ID  │   │  Multi-Sensor ID │   │  Experiment ID   │
│ (Phase 21 EEG)   │   │ (Phase 23 IMU)   │   │ (Phase 22 Replay)│
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
                 ┌────────────────────────────────┐
                 │     Phase 17 Safety Gate       │
                 └──────────────┬─────────────────┘
                                ▼
                 ┌────────────────────────────────┐
                 │     Phase 20 ESP32 HIL ACK     │
                 └────────────────────────────────┘
```

---

## 4. Non-Destructive Reset Semantics

When `POST /api/product/session/reset` or `POST /api/product/demo/reset` is invoked:
1. Active demo state machine transitions to `IDLE`.
2. Active demo run cache and WebSocket broadcast buffers are cleared.
3. A fresh, valid `ProductSession` is initialized with clean lineage IDs.
4. **Invariant**: Existing scientific experiments, raw datasets, and historical audit logs remain untouched.
