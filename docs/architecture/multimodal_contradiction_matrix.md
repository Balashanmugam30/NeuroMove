# NeuroMove — Phase 23: Multimodal Contradiction Detection Matrix

## 1. Contradiction Rules & Precedence Hierarchy

The `ContradictionDetector` evaluates 5 explicit rules on every multimodal frame. Contradiction outcomes follow strict precedence:

$$\text{INVALID} \succ \text{HOLD} \succ \text{DEGRADED} \succ \text{INFORMATIONAL}$$

---

## 2. Contradiction Matrix

| Rule Name | Trigger Condition | Outcome | Severity | Downstream Safety Action |
|---|---|---|---|---|
| `CONTRADICTION_INTENT_VS_MOTION` | Active intent ($FORWARD/LEFT/RIGHT$) + Accel spike ($> 6.0\text{ }m/s^2$) | `HOLD` | `HIGH` | Cap confidence at $0.40$; Phase 17 executes safety hold; zero HIL transmission |
| `CONTRADICTION_DESYNCHRONIZATION` | Multi-clock sync state = `UNSYNCHRONIZED` or offset $> 100\text{ ms}$ | `HOLD` | `HIGH` | Freeze dependent multimodal fusion; log diagnostic event |
| `CONTRADICTION_SENSOR_DEGRADED` | Streaming sensor fails QC (flatline/dropout/saturation) | `DEGRADED` | `MEDIUM` | Fall back to robust single-modality EEG or safe hold |
| `CONTRADICTION_UNINITIALIZED_CALIBRATION` | Streaming sensor lacks valid baseline calibration | `HOLD` | `MEDIUM` | Require recalibration before enabling active intent evaluation |
| `CONTRADICTION_OCULAR_CONTAMINATION` | EOG blink pulse ($> 80\text{ }\mu\text{V}$) concurrent with intent window | `INFORMATIONAL` | `LOW` | Mark EEG epoch as contaminated; downstream follow existing rejection |
