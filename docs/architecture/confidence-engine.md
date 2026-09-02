# NeuroMove Architecture: Confidence Estimation Engine

## 1. System Role & Boundaries
The **Confidence Estimation Engine** sits deterministically between the active motor-imagery decoder model and temporal confirmation:

$$\text{EEG Acquisition / Simulation} \longrightarrow \text{DSP \& Feature Extraction} \longrightarrow \text{Active Decoder} \longrightarrow \text{Prediction} \longrightarrow \mathbf{CONFIDENCE\ ESTIMATION} \longrightarrow \text{Temporal Confirmation} \longrightarrow \text{Phase 16 Intent State Machine}$$

### Explicit Non-Goals:
- **Confidence is NOT ground truth**: An estimate of $0.95$ does not prove clinical accuracy.
- **High confidence is NOT safety clearance**: Safe robotics requires independent arbitration (Phase 17).
- **No autonomous retraining**: Models are updated strictly via the Phase 14 controlled update pipeline.

---

## 2. Multi-Factor Confidence Formulation
Rather than relying on raw classifier outputs (which can be uncalibrated decision distances or distorted probabilities), the engine evaluates six explicit components:

$$C = c_{\text{score}} \times \left(0.70 + 0.30 \cdot c_{\text{margin}}\right) \times c_{\text{quality}} \times c_{\text{freshness}} \times c_{\text{validity}}$$

Where:
- $c_{\text{score}} \in [0.0, 1.0]$: Model score calibrated via Platt scaling, isotonic regression, or sigmoid mapping.
- $c_{\text{margin}} \in [0.0, 1.0]$: Normalized separation between the top predicted class and runner-up ($\Delta = s_{\text{top}} - s_{\text{runner\_up}}$).
- $c_{\text{quality}} \in [0.0, 1.0]$: Signal quality score (evaluated against the configured `quality_floor`, e.g. $0.50$).
- $c_{\text{freshness}} \in [0.0, 1.0]$: Evaluates sample timestamp against `max_age_ms` ($400\text{ms}$).
- $c_{\text{validity}} \in \{0.0, 1.0\}$: Binary validation status confirming the model is active, not rolled back, and feature-compatible.

---

## 3. Strict Eligibility & Rejection Gating
Inputs that fail critical data quality or operational requirements are immediately gated out:

| Failure Condition | Eligibility Outcome | Band | Decision Text |
| :--- | :--- | :--- | :--- |
| $\text{Prediction} \in \{\text{REST}, \text{NONE}, \text{UNKNOWN}\}$ | `NO_PREDICTION` | `UNKNOWN` | Class is non-directional or rest. |
| $\text{Signal Quality} < \text{quality\_floor}$ | `LOW_SIGNAL` | `UNKNOWN` | Signal quality score below floor ($q < 0.50$). |
| $\text{Data Age} > \text{max\_age\_ms}$ | `STALE` | `UNKNOWN` | Data frame exceeds allowable age ($t > 400\text{ms}$). |
| Model rolled back or incompatible | `MODEL_INVALID` | `UNKNOWN` | Active model version status is invalid. |
| $C < \text{min\_eligible\_confidence}$ | `INSUFFICIENT_CONFIDENCE` | `LOW` | Confidence below minimum eligible floor ($C < 0.40$). |

---

## 4. Confidence Bands
- **HIGH**: $C \ge 0.75$
- **MEDIUM**: $0.55 \le C < 0.75$
- **LOW**: $0.40 \le C < 0.55$
- **UNKNOWN**: Ineligible, non-directional, or $C < 0.40$
