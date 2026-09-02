# NeuroMove — Phase 23: Multimodal Sensor Fusion Strategy

## 1. Objective & Non-Actuation Invariant

Sensor fusion in NeuroMove is designed to enrich neurophysiological context without diluting the authority of the cortical EEG intent pipeline:
- **EEG remains primary** for candidate intent classification ($FORWARD$, $BACKWARD$, $LEFT$, $RIGHT$, $REST$).
- **Auxiliary sensors provide context evidence**:
  - IMU provides chassis and head stability context.
  - EMG provides voluntary peripheral muscle activation context.
  - EOG provides ocular artifact contamination context.
  - PPG provides autonomic arousal & pulse rate.
  - Pressure provides presence and seating engagement context.

---

## 2. Confidence Modulation Formulation

Let $C_{\text{EEG}} \in [0, 1]$ be the candidate intent confidence computed from the EEG feature and classifier pipeline (Phases 10--15). The fused context confidence $C_{\text{final}}$ is modulated according to cross-modality agreement and contradiction gating:

$$C_{\text{final}} = \begin{cases} 
0.0 & \text{if Contradiction Outcome} = \text{INVALID} \\
\min(C_{\text{EEG}}, 0.40) & \text{if Contradiction Outcome} = \text{HOLD} \\
\min(C_{\text{EEG}} \cdot (0.70 + 0.30 \cdot S_{\text{fused}}), 0.70) & \text{if Contradiction Outcome} = \text{DEGRADED} \\
\min(1.0, C_{\text{EEG}} \cdot (0.85 + 0.15 \cdot S_{\text{fused}})) & \text{if Nominal / Fully Synchronized}
\end{cases}$$

Where $S_{\text{fused}} = \frac{1}{N} \sum_{i=1}^N c_i$ is the mean cross-sensor evidence confidence.
