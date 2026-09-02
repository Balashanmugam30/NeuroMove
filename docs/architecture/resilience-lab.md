# NeuroMove Architecture — Failure Injection & Fault-Tolerance Laboratory

## 1. Overview & Architectural Role

Phase 18 introduces the **Failure Injection, Fault-Tolerance, Resilience & Deterministic Recovery Laboratory** (`NEUROMOVE-P18`) for NeuroMove.

Unlike Phases 1–17, Phase 18 does **not** introduce a new operational decision or processing stage in the BCI pipeline. Instead, it serves as a cross-cutting reliability test harness that deliberately perturbs the existing software stack:

$$\text{Phase 18 Fault Injector} \longrightarrow \text{Existing Pipeline (P15 Confidence, P16 Intent, P17 Safety, Storage, Transport)} \longrightarrow \text{Observed Behavior} \longrightarrow \text{Invariant Evaluator} \longrightarrow \text{Recovery Evaluator}$$

### Fundamental Question
> *"When the NeuroMove pipeline experiences controlled software failures, does every subsystem degrade predictably, preserve safety invariants, recover deterministically, and leave an auditable trail?"*

---

## 2. Core Safety Objective

### Non-Negotiable Invariant: Zero Accidental Authorization
A software failure or degraded subsystem **MUST NEVER CREATE AN ACCIDENTAL AUTHORIZATION**:
- Backend unavailable $\to$ `NOT AUTHORIZED`
- Database unavailable $\to$ `NOT AUTHORIZED`
- WebSocket disconnected $\to$ `NOT AUTHORIZED`
- Confidence service unavailable $\to$ `NOT AUTHORIZED`
- Intent snapshot stale $\to$ `NOT AUTHORIZED`
- Safety state unknown $\to$ `NOT AUTHORIZED`
- Model provenance unavailable $\to$ `NOT AUTHORIZED`
- Event ordering uncertain $\to$ `NOT AUTHORIZED`

Under any partial failure, the safety outcome must strictly fail closed into:
$$\text{HELD},\quad \text{DENIED},\quad \text{EMERGENCY\_STOP},\quad \text{or}\quad \text{LOCKED\_OUT}$$
**Never** default to implicit allow.

---

## 3. Scope Boundary & Phase 19 Handoff

### Absolute Scope Boundary
- Phase 18 is a **pure software fault-tolerance and resilience laboratory**.
- **Out of Scope**: Zero ESP32 protocol code, zero hardware communication, zero motor commands, zero servo/actuator control, zero physical emergency-stop hardware circuits, and zero clinical safety claims.
- **Phase 19 Handoff**: Phase 19 will receive the authoritative software safety decision (`SafetyDecision.AUTHORIZED`) and implement the ESP32 transport protocol. Phase 18 proves that the pipeline leading to that token is completely robust under failure.

---

## 4. Lab Isolation & Mode Separation

To prevent test faults from contaminating production operations:
- **Explicit Lab Mode**: Faults are only active within an experiment context (`lab_mode == "EXPERIMENT_ACTIVE"`).
- **Automated Cleanup**: Every experiment teardown automatically clears all active faults and restores subsystem context to healthy defaults.
- **Fail-Safe Default**: If the resilience harness itself detects uncertainty or missing audit evidence, it reports `RECOVERY_UNCERTAIN` and blocks execution authorization.
