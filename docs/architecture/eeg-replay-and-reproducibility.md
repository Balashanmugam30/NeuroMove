# EEG Replay, Reproducibility & Golden Scenarios Architecture

## 1. 10 Golden Verification Scenarios

Phase 21 includes 10 automated Golden Verification Scenarios (`EegScenarioRegistry`):

| Scenario ID | Scenario Name | Invariants Verified |
|---|---|---|
| `SCENARIO_A` | Simulator Full End-to-End Pipeline | Full pipeline from synthetic signal to ESP32 HIL frame ACK |
| `SCENARIO_B` | Recorded Fixture Full Pipeline Replay | SHA-256 fixture checksum validation and multi-channel replay |
| `SCENARIO_C` | Physical Adapter Safe Probing | Safe port enumeration, honest unavailable reporting, zero fake hardware |
| `SCENARIO_D` | Single-Channel Flatline Quality Gating | C3 flatline detection, calibration failure, intent gating |
| `SCENARIO_E` | Timestamp Discontinuity Recovery | Backward jump detection, monotonicity verification, offset adjustment |
| `SCENARIO_F` | Ambiguous Intent Low Confidence Hold | Calibrated confidence thresholding, Phase 17 HELD, 0 HIL frames |
| `SCENARIO_G` | Fully Authorized Intent Execution | Pre-flight authorization validation, frame delivery, transport status |
| `SCENARIO_H` | Mid-Stream Disconnect Containment | Safe stream termination on sudden hardware unplug |
| `SCENARIO_I` | Reconnect & Fresh Session Boundary | Session re-initialization and sequence counter reset |
| `SCENARIO_J` | Deterministic Fixture Replay | Identical output features and decisions across multiple runs |

## 2. Replay Fixtures & Integrity

The fixture file `compact_eeg_fixture.json` provides an immutable, lightweight 8-channel EEG dataset containing 500 samples of motor-imagery signals. On load, `RecordedEegAcquisitionAdapter` computes the SHA-256 digest of the file content and verifies it against the fixture manifest.
