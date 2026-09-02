# NeuroMove — Phase 23: Multimodal Sensor Acquisition Architecture

## 1. Executive Summary

Phase 23 extends NeuroMove beyond single-stream EEG acquisition into an institutional-grade, multi-modality research and verification platform. The canonical acquisition layer interfaces with diverse bio-signal and physical sensor modalities:
- **EEG**: Cortical motor imagery ($8\text{--}64$ channels, $\mu\text{V}$, $250\text{--}1000\text{ Hz}$).
- **IMU**: $6\text{--}9\text{ DOF}$ accelerometry and rate gyroscopy ($m/s^2, ^\circ/s$, $50\text{--}200\text{ Hz}$) capturing head jerk and wheelchair vibration.
- **EMG**: Peripheral muscle surface activation ($2\text{--}8$ channels, $\mu\text{V}$, $500\text{--}2000\text{ Hz}$) confirming somatic intent.
- **EOG**: Electrooculography ($2\text{--}4$ channels, $\mu\text{V}$, $250\text{ Hz}$) flagging eye blinks and saccades.
- **PPG**: Photoplethysmography ($1\text{--}2$ channels, $\text{mV}$, $50\text{--}100\text{ Hz}$) providing pulse rate and autonomic stress state.
- **PRESSURE**: Seat matrix & grip force ($4\text{--}16$ zones, $\text{kPa}$, $20\text{--}100\text{ Hz}$) confirming user presence and posture.

---

## 2. Canonical Evidence Hierarchy & Strict Non-Actuation Invariant

```
AUXILIARY SENSORS (IMU, EMG, EOG, PPG, PRESSURE)
       │
       ▼ (EVIDENCE / CONTEXT ONLY)
[ CONTEXT VERIFICATION & FUSION ENGINE ] ──► [ SAFETY ARBITRATION (Phase 17) ]
       ▲                                                   │
       │                                                   ▼
[ EEG DSP & INTENT ENGINE ] ─────────────────► [ ESP32 HIL VIRTUAL EMULATOR (Phase 20) ]
```

> **NON-ACTUATION LAW**: Auxiliary sensors provide observational evidence and neurophysiological context *only*. No physical auxiliary sensor is ever directly connected to an actuator, motor driver, PWM channel, or robot chassis. All downstream transmission is arbitrated strictly by Phase 17 Safety and received by Phase 20 ESP32 virtual emulator ($0$ physical motors).

---

## 3. Sensor Device Abstraction Layer

All sensor streams implement the unified `SensorAcquisitionAdapter` contract:
1. **`SimulatedSensorAdapter`**: Deterministic, seeded synthetic generator producing coupled signals across EEG, IMU, EMG, EOG, PPG, and Pressure.
2. **`RecordedSensorAdapter`**: Immutable replay adapter reading recorded multimodal fixtures with SHA-256 integrity checksums.
3. **`PhysicalSensorAdapter`**: Honest hardware adapter interfacing with serial COM / USB ports. If hardware is disconnected or absent, it explicitly reports `is_available: False` and never silently substitutes synthetic data.

---

## 4. Database Schema (Migration 017)

All multimodal devices, sessions, calibrations, fusions, contradictions, and recordings are persisted in SQLite across 11 relational tables:
- `multimodal_sensor_devices`
- `multimodal_sensor_sessions`
- `multimodal_sensor_configs`
- `multimodal_sensor_health`
- `multimodal_clock_sync`
- `multimodal_calibrations`
- `multimodal_fusion_results`
- `multimodal_context_events`
- `multimodal_contradictions`
- `multimodal_recordings`
- `multimodal_fixtures`
