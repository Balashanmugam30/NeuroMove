# NeuroMove — Demo Orchestration & Finite State Machine

## 1. Executive Summary

The **DemoOrchestrator** is a centralized backend service (`neuromove.product.orchestrator`) that drives deterministic, guided product demonstrations across 9 canonical stages without exposing low-level engineering complexity to competition judges.

---

## 2. 9-Stage Guided Demonstration Sequence

```
1. DATA_SOURCE ────────► Selects SIMULATOR, RECORDED, or PHYSICAL provider.
       │
2. ACQUISITION ────────► Ingests 8 EEG channels with real-time sequence and SNR tracking.
       │
3. MULTIMODAL_CONTEXT ──► Normalizes multi-clock domain, checks sync (< 2.5ms), runs QC.
       │
4. DECODING ───────────► Projects bandpass CSP spatial filter, outputs candidate intent.
       │
5. CONFIDENCE ─────────► Evaluates 4-epoch temporal confirmation window against 0.70 threshold.
       │
6. INTENT ─────────────► Advances FSM from Candidate to Confirmed to Activated.
       │
7. SAFETY ─────────────► Evaluates 12 Phase 17 safety invariants before authorizing.
       │
8. HIL_EXECUTION ──────► Frames Phase 19 transport packet and receives Phase 20 ESP32 ACK.
       │
9. RESULT ─────────────► Seals execution provenance and exports reproducible demonstration summary.
```

---

## 3. Demo Finite State Machine (FSM)

The `DemoStateMachine` enforces strict transition legality:

$$\text{IDLE} \longrightarrow \text{SOURCE\_READY} \longrightarrow \text{ACQUIRING} \longrightarrow \text{CONTEXT\_READY} \longrightarrow \text{DECODING} \longrightarrow \text{CONFIRMING} \longrightarrow \text{INTENT\_READY} \longrightarrow \text{SAFETY\_CHECK} \longrightarrow \text{AUTHORIZED} \longrightarrow \text{HIL\_EXECUTING} \longrightarrow \text{COMPLETED}$$

### Alternative Exit Branches
- **`HELD`**: Triggered when confidence $< 0.70$ or auxiliary motion contradiction is detected. Halts execution with zero downstream transport frames transmitted.
- **`DENIED`**: Triggered on lockout or emergency stop conditions.
- **`FAILED`**: Triggered on unrecoverable stream disconnection or nonfinite signals.
- **`RECOVERING`**: Triggered during dynamic fault recovery scenarios (`PRODUCT_E`).
