# NeuroMove — Phase 23: Neurophysiology Context Engine

## 1. Neurophysiology State Machine

The `NeurophysiologyContextEngine` converts low-level multimodal features into high-level cognitive and physiological context states.

```
                      ┌────────────────────────────────┐
                      │    Stationary Quiet Baseline   │
                      │  (MOTION_QUIET, Contact True)  │
                      └───────────────┬────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│       Active Motion       │                   │    Ocular Contamination   │
│  (std_mag > 0.25 m/s^2)   │                   │    (EOG Peak > 80 uV)     │
└─────────────┬─────────────┘                   └─────────────┬─────────────┘
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      ▼
                      ┌────────────────────────────────┐
                      │    Contaminated / Safety Hold  │
                      │    (Movement Invalidated)      │
                      └────────────────────────────────┘
```

---

## 2. Context Fields & Evaluation Semantics

1. **`motion_state`** (`STATIONARY` vs `MOVING`):
   Derived from 3-axis accelerometer vector magnitude standard deviation:
   $$\sigma_{\text{mag}} = \sqrt{\frac{1}{N} \sum_{i=1}^N (\|\mathbf{a}_i\| - \bar{\|\mathbf{a}\|})^2}$$
2. **`motion_contamination_state`**:
   - `MOTION_QUIET`: $\sigma_{\text{mag}} \le 0.25\text{ }m/s^2$
   - `MOTION_ACTIVE`: $0.25 < \sigma_{\text{mag}} \le 1.5\text{ }m/s^2$
   - `LIKELY_CONTAMINATED`: $\sigma_{\text{mag}} > 1.5\text{ }m/s^2$
3. **`ocular_artifact_detected`**:
   True when $|V_{\text{EOG}}| > 80\text{ }\mu\text{V}$, flagging blink/saccade coincidence during intent decoding windows.
4. **`contact_present`**:
   True when average seat matrix pressure exceeds $1.0\text{ kPa}$, confirming subject engagement.
