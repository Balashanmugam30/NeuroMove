# NeuroMove Canonical Domain Model

## 1. Architectural Purpose

NeuroMove integrates real-time electrophysiological acquisition, digital signal processing (DSP), machine learning inference, temporal confirmation, independent safety arbitration, and local robot motor actuation.

To prevent architectural entropy and type fragmentation, the entire platform adheres to a single **Canonical Domain Model** with cross-language parity between Python (Pydantic) and TypeScript (Zod).

```
Motor-Imagery EEG (C3, Cz, C4)
            ↓
  Signal Quality Validation
            ↓
Bandpass & Common Average Reference
            ↓
  CSP Spatial Filtering
            ↓
 Regularized LDA Classifier
            ↓
Prediction (Class Probabilities & Neural Confidence)
            ↓
 Temporal Confirmation Window
            ↓
Intent Confirmed (LEFT / RIGHT / FORWARD / STOP)
            ↓
 Independent Safety Arbitration
            ↓
Safety Decision (APPROVED / BLOCKED / STOP)
            ↓
 Robot Command (REQUESTED / APPROVED / SENT)
            ↓
ESP32 Motor Driver / Mobile Platform
```

---

## 2. Core Separation of Concerns

A fundamental invariant of NeuroMove is the strict separation between prediction, intent, safety evaluation, and physical actuation:

1. **Prediction $\neq$ Intent**:
   - `Prediction`: Raw statistical classification output from the spatial filter and classifier (e.g. `RIGHT: 0.92`).
   - `Intent`: Debounced, temporally confirmed cognitive command (e.g. 3 consecutive epochs exceeding the posterior confidence threshold).
2. **Intent $\neq$ Safety Decision**:
   - A confirmed user intent (e.g., `FORWARD`) is evaluated by the independent safety arbitrator against obstacle telemetry, battery health, and state machine boundaries.
3. **Safety Decision $\neq$ Robot Command**:
   - `APPROVED` authorization generates a `RobotCommand` in `REQUESTED` $\to$ `APPROVED` status.
   - `BLOCKED` decision records the block reason and sets command status to `BLOCKED` without mutating or erasing the original neural prediction.
4. **Robot Command $\neq$ Physical Execution**:
   - A command is only executed when confirmed and acknowledged by the local hardware adapter over serial CRC16.
5. **Simulation $\neq$ Replay $\neq$ Live**:
   - `SIMULATION`: Synthetic or mathematically emulated electrophysiology.
   - `REPLAY`: Deterministic playback of recorded sessions.
   - `LIVE`: Verified physical hardware acquisition.

---

## 3. Canonical Identifiers

All domain entities utilize strongly typed, pseudonymous string identifiers with standard prefixes:

| Entity                | Prefix | Example                |
| :-------------------- | :----- | :--------------------- |
| **User Profile**      | `usr_` | `usr_9a2f10bcde`       |
| **Session**           | `ses_` | `ses_8821ab4510`       |
| **Trial**             | `trl_` | `trl_01a2b3c4d5`       |
| **Experiment**        | `exp_` | `exp_7712ba09`         |
| **Model Artifact**    | `mdl_` | `mdl_csp_lda_v1`       |
| **Event**             | `evt_` | `evt_9a4f21bc08412e89` |
| **Robot Command**     | `cmd_` | `cmd_44a10bcdef`       |
| **Correlation Trace** | `cor_` | `cor_78ef9012a456`     |
| **EEG Window**        | `win_` | `win_0042`             |

> [!IMPORTANT]
> To preserve participant privacy, human names, emails, medical record numbers, or IP addresses are **never** used as identifiers.

---

## 4. Canonical Enumerations

### `OperatingMode`

- `SIMULATION` (Default): Mathematical sensorimotor generators.
- `REPLAY`: Historical recorded session data.
- `LIVE`: Verified hardware acquisition.

### `Intent`

- `NONE`: Baseline rest state.
- `LEFT`: Left hand motor-imagery ($C_4$ $\mu$-rhythm ERD).
- `RIGHT`: Right hand motor-imagery ($C_3$ $\mu$-rhythm ERD).
- `FORWARD`: Bilateral or feet imagery.
- `BACKWARD`: Specialized auxiliary imagery.
- `STOP`: Explicit mental halt or relaxation.
- `UNCERTAIN`: Ambiguous or below-threshold signal.

### `RuntimeState`

- `IDLE`: Safe, unactuated default.
- `CALIBRATING`: Structured cue presentation protocol.
- `READY`: Online, monitoring baseline.
- `CANDIDATE`: Transient single-epoch intent detected.
- `CONFIRMED`: Temporally confirmed intent.
- `EXECUTING`: Active mobility command dispatch.
- `BLOCKED`: Safety arbitration intervention.
- `EMERGENCY`: Fail-safe zero-velocity override.
- `FAULT`: Hardware disconnection or signal loss.
- `UNCERTAIN`: Insufficient confidence hold.

### `SafetyDecision`

- `APPROVED`: Intent verified safe for execution.
- `BLOCKED`: Environmental or risk barrier prevents execution.
- `STOP`: Immediate halt commanded.

### `RiskLevel`

- `SAFE`: Nominal operating perimeter.
- `WARNING`: Approaching boundary or degraded impedance.
- `CRITICAL`: Obstacle breach, emergency stop, or disconnection.

---

## 5. Domain Invariants

1. **Emergency Priority**: An active emergency stop (`emergency_active=True`) cannot coexist with an `APPROVED` safety decision.
2. **Safe Default**: System initialization and connection loss always default to `IDLE` state.
3. **No Non-Directional Movement**: `NONE` and `UNCERTAIN` intents cannot be approved as directional robot motion commands.
4. **Timezone Awareness**: All timestamps across Python and TypeScript models are strictly timezone-aware UTC in ISO-8601 representation.
