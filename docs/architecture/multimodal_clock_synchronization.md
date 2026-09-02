# NeuroMove — Phase 23: Multi-Clock Synchronization & Drift Management

## 1. Multi-Clock Architecture

In a multimodal neurophysiology acquisition platform, each sensor stream operates on its own local crystal oscillator or sample counter. Without rigorous time normalization, inter-sensor timestamp skew corrupts cross-modality feature alignment and leads to false positive artifact rejection or unsafe intent triggering.

```
Device Clocks (Local Crystals)        Host Receive Timeline
┌───────────────────────────┐         ┌───────────────────────────┐
│ EEG (250 Hz, t_dev)       │────────►│                           │
│ IMU (100 Hz, t_dev)       │────────►│  Multimodal Clock         │──► Normalized Monotonic
│ EMG (500 Hz, t_dev)       │────────►│  Normalizer & Sync Coord  │    Session ISO Timestamps
│ EOG (250 Hz, t_dev)       │────────►│                           │
└───────────────────────────┘         └───────────────────────────┘
```

---

## 2. Mathematical Normalization Model

For sensor $k$ with nominal sampling rate $f_s^{(k)}$ and sample interval $\Delta t^{(k)} = \frac{1}{f_s^{(k)}}$:
1. **Device Elapsed Time**:
   $$\Delta t_{\text{device}}^{(k)} = t_{\text{dev}}^{(k)} - t_{\text{start, dev}}^{(k)}$$
2. **Host Elapsed Time**:
   $$\Delta t_{\text{host}} = t_{\text{receive}} - t_{\text{start, host}}$$
3. **Clock Offset**:
   $$\text{Offset}_{\text{ms}}^{(k)} = (\Delta t_{\text{device}}^{(k)} - \Delta t_{\text{host}}) \times 1000$$
4. **Estimated Drift (ppm)**:
   $$\text{Drift}_{\text{ppm}}^{(k)} = \left( \frac{\Delta t_{\text{device}}^{(k)} - \Delta t_{\text{host}}}{\Delta t_{\text{host}}} \right) \times 10^6$$

---

## 3. Disparity Thresholds & State Transitions

| Metric | Threshold | Synchronization State | Pipeline Action |
|---|---|---|---|
| Max Offset Disparity | $\le 30\text{ ms}$ & Drift $\le 50\text{ ppm}$ | `SYNCHRONIZED` | Full multimodal fusion enabled |
| Drift Exceeded | Drift $> 50\text{ ppm}$ | `DRIFT_DETECTED` | Informational diagnostic flag |
| Moderate Offset | $30\text{ ms} < \text{Offset} \le 100\text{ ms}$ | `DEGRADED` | Modulates BCI confidence downward ($0.70$ ceiling) |
| Severe Disparity | $\text{Offset} > 100\text{ ms}$ or Drift $> 500\text{ ppm}$ | `UNSYNCHRONIZED` | Triggers contradiction interlock; dependent fusion blocked |
