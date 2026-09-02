# NeuroMove — Phase 23: 12 Golden Verification Scenarios

## 1. Golden Scenarios Audit Suite

| Scenario ID | Name | Core Verification Target | Expected Invariant Outcome |
|---|---|---|---|
| `SCENARIO_A` | EEG + IMU Healthy Baseline | Healthy synchronized streams | Valid context $\rightarrow$ Phase 17 `AUTHORIZED` $\rightarrow$ Phase 20 HIL ACK |
| `SCENARIO_B` | EEG Only Standalone | Single-modality EEG operation | Does not falsely require auxiliary sensors; operates nominally |
| `SCENARIO_C` | IMU Disconnect | Explicit auxiliary disconnect | Graceful degradation; safe continuation or hold; zero unsafe dispatch |
| `SCENARIO_D` | Timestamp Drift & Desync | Large clock offset ($> 100\text{ ms}$) | Sync status `UNSYNCHRONIZED`; dependent fusion held |
| `SCENARIO_E` | Contradictory Movement Hold | Sudden violent motion during intent | Contradiction detected; safety hold; zero HIL transmission |
| `SCENARIO_F` | Channel Dropout Quality Fault | Zero-signal dropout on channels | QC degradation; dependent analysis invalidated; no unsafe dispatch |
| `SCENARIO_G` | EMG Peripheral Activation | Peripheral muscle burst | EMG evidence integrated into fusion context |
| `SCENARIO_H` | EOG Ocular Artifact Indicator | Ocular blink spike | Flags contaminated EEG window |
| `SCENARIO_I` | Deterministic Fixture Replay | Same fixture + config | 100% reproducible checksum and context score |
| `SCENARIO_J` | Fault Recovery & Recalibration | Disconnect $\rightarrow$ Degrade $\rightarrow$ Reconnect | Recalibration restores clean synchronized state |
| `SCENARIO_K` | Authorized End-to-End | Authorized multimodal pipeline | Dispatched strictly to Phase 20 virtual emulator ($0$ physical motors) |
| `SCENARIO_L` | Unsafe Multimodal State | Stale / invalid multimodal context | Zero Phase 19/20 transmissions |
