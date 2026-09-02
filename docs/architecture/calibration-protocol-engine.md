# Calibration Protocol Engine & Deterministic Sequencing

## 1. Declarative Graz Protocol Definition
The calibration sequence is generated from a declarative `CalibrationProtocol` object:
- **Target Classes**: `LEFT_IMAGERY`, `RIGHT_IMAGERY`
- **Trials Per Class**: 10 (default), 20, or 40 balanced trials
- **Sub-Phase Timing**:
  - Rest: 2.0s
  - Fixation Cross: 2.0s
  - Visual Cue Arrow: 1.25s
  - Motor Imagery Execution: 4.0s
  - Inter-Trial Interval (ITI): 1.5s–2.5s (pseudo-randomized)

## 2. Deterministic Pseudo-Random Generation
Given a protocol configuration and an integer `random_state`, `CalibrationProtocolEngine.generate_trial_sequence()` produces an identical permutation of trials and exact onset offsets every time. Silent shuffling is strictly prohibited.
