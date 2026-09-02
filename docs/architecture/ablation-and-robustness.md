# Ablation Studies & Robustness Perturbation Sweeps

## 1. Controlled Ablations

The `AblationEngine` isolates causal algorithmic components without mutating baseline experiments:

| Ablation Type | Description | Parameter Delta |
|---|---|---|
| `CHANNEL_DROPOUT` | Subset electrode montages | `{"channel_names": ["C3", "Cz", "C4"]}` |
| `BANDPASS_FILTER` | Filter frequency shift | `{"dsp_config": {"lowcut": 10.0, "highcut": 20.0}}` |
| `CONFIDENCE_THRESHOLD` | Gating sensitivity | `{"confidence_policy": {"threshold": 0.90}}` |
| `PERSONALIZATION_TOGGLE`| Disable subject calibration | `{"personalization_profile": {"enabled": false}}` |

## 2. Robustness & Stress Testing

The `RobustnessEngine` sweeps signal perturbations across 5 severity levels ($0.1, 0.25, 0.5, 0.75, 1.0$):
- **`ADDITIVE_NOISE`**: Gaussian white noise $\mathcal{N}(0, \sigma^2 \cdot \text{level})$.
- **`AMPLITUDE_SCALING`**: Signal gain $(1.0 + \text{level})$.
- **`CHANNEL_DROPOUT`**: Random channel zeroing.
- **`PACKET_LOSS`**: Simulated transport dropouts.
- **`AMPLITUDE_CLIPPING`**: Extreme biopotential voltage clamping.
- **`VARIANCE_PERTURBATION`**: Inter-electrode variance drift.
