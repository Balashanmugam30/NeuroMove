# NeuroMove Predefined Simulation Scenarios

## 1. Catalog of Scenarios

The simulator provides 9 standard canonical scenarios for integration testing:

| # | ID | Scenario Name | Duration | Description |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `idle` | Baseline Idle & Rest | 8.0s | Resting state with zero obstacles and stationary robot. |
| **2** | `right-turn` | Right Turn Motor Imagery | 10.0s | Fixation $\to$ Right Cue $\to$ $C_3$ $\mu$-ERD desynchronization $\to$ high confidence RIGHT prediction. |
| **3** | `left-turn` | Left Turn Motor Imagery | 10.0s | Fixation $\to$ Left Cue $\to$ $C_4$ $\mu$-ERD desynchronization $\to$ high confidence LEFT prediction. |
| **4** | `low-confidence` | Low Confidence & Ambiguity | 9.0s | High noise, unstable probabilities, below-threshold UNCERTAIN prediction. |
| **5** | `right-obstacle` | Right Proximity Obstacle Hazard | 10.0s | Confirmed RIGHT intent with right perimeter obstacle hazard (35cm) $\to$ `SAFETY_BLOCKED`. |
| **6** | `emergency` | Immediate Emergency Stop | 8.0s | Active movement trial interrupted by emergency stop trigger $\to$ fail-closed safe state. |
| **7** | `eeg-disconnect` | EEG Lead-Off & Disconnect | 8.0s | Continuous stream interrupted by electrode lead-off / disconnect $\to$ dropped sample flags. |
| **8** | `robot-disconnect` | Robot Telemetry Timeout | 8.0s | Robot serial connection lost $\to$ `DISCONNECTED` state $\to$ commands inhibited. |
| **9** | `full-demo` | Comprehensive End-to-End Demo | 16.0s | Full multi-stage trial: READY $\to$ Right Turn $\to$ Obstacle $\to$ Forward $\to$ E-Stop. |

---

## 2. Declarative Scenario Schema

Scenarios are defined in `services/core/neuromove/simulation/scenarios.py` with declarative steps:

```python
ScenarioStep(
    time_seconds=3.5,
    cue="IMAGERY_RIGHT",
    target_intent=Intent.RIGHT,
    confidence_profile="HIGH",
    obstacle_direction="NONE",
    obstacle_distance_cm=200.0,
    inject_fault=None,
    trigger_emergency=False,
    description="Motor imagery execution window",
)
```
