# NeuroMove Architecture — Failure Recovery & Checkpoints

## 1. Safe Recovery Principles

Recovery in NeuroMove is designed to be **more conservative than normal operation**:

$$\text{Failure Incurred} \longrightarrow \text{Restrictive Safety State} \longrightarrow \text{Recovery Orchestrated} \longrightarrow \text{Checkpoint Verified} \longrightarrow \mathbf{SAFE\_IDLE} \longrightarrow \text{Fresh Evaluation Required}$$

### Core Recovery Invariants
1. **Never Auto-Resume Stale Authorization**: When a failure is cleared, the system returns strictly to `SAFE_IDLE`. It never automatically resumes an authorization that was in-flight when the failure occurred.
2. **Persistent Restrictive States**: If a service restart occurs while in `EMERGENCY_STOP` or `LOCKED_OUT`, the system recovers directly into `EMERGENCY_STOP` or `LOCKED_OUT`. A reboot is **never** an implicit safety bypass.
3. **Verified Reset Sequence**: Clearing an emergency stop moves the machine to `RESET_PENDING`. An explicit, verified reset action is mandatory before reaching `SAFE_IDLE`.

---

## 2. Dependency-Ordered Recovery

Subsystem restoration enforces strict topological dependency ordering:

$$\text{Database} \longrightarrow \text{Core Storage} \longrightarrow \text{Confidence Service} \longrightarrow \text{Intent Machine} \longrightarrow \text{Safety Gate} \longrightarrow \text{Transport Stream} \longrightarrow \text{UI Observers}$$

No dependent service may declare itself healthy before its prerequisites have been verified.

---

## 3. Data Loss Classification

Data loss during faults is explicitly classified:
- `NONE`: Complete zero-loss restoration.
- `TRANSIENT`: In-flight buffers dropped; persistent audit intact.
- `AUDIT_ONLY`: Non-critical telemetry logging dropped.
- `NON_CRITICAL`: Auxiliary context missing; core safety unaffected.
- `CRITICAL`: Inconsistent safety, session, or model state. **Authorizations strictly barred until fresh session initialization.**
