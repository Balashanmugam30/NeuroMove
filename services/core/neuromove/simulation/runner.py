"""NeuroMove Simulation Engine Orchestrator.

Integrates clock, EEG generator, scenario protocol, decoders, robot kinematics,
and event dispatcher into a unified deterministic simulation core.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime

from pydantic import BaseModel, Field

from neuromove.domain.enums import (
    CommandStatus,
    EventType,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
    SessionStatus,
)
from neuromove.domain.models import (
    RobotState,
    Session,
    SignalQualityMetrics,
    Trial,
)
from neuromove.events.dispatcher import EventDispatcher, default_dispatcher
from neuromove.events.envelope import (
    EventEnvelope,
    IntentConfirmedPayload,
    RobotCommandPayload,
    RobotStatePayload,
    SafetyAlertPayload,
    SafetyDecisionPayload,
    SessionLifecyclePayload,
    SignalQualityPayload,
)
from neuromove.simulation.clock import SimulationClock
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import EEGChunk, SyntheticEEGGenerator
from neuromove.simulation.fault_injector import FaultInjector, FaultType
from neuromove.simulation.obstacle_simulator import ObstacleData, ObstacleSimulator
from neuromove.simulation.prediction_generator import SyntheticPredictionGenerator
from neuromove.simulation.robot_simulator import RobotSimulator
from neuromove.simulation.scenarios import ScenarioStep, SimulationScenario, get_scenario

logger = logging.getLogger("neuromove.simulation")


class SimulationStatus(BaseModel):
    """Current live runtime state of the simulation engine."""

    is_running: bool = False
    is_paused: bool = False
    mode: OperatingMode = OperatingMode.SIMULATION
    scenario_id: str | None = None
    scenario_name: str | None = None
    seed: int = 42
    speed: float = 1.0
    elapsed_seconds: float = 0.0
    total_duration_seconds: float = 0.0
    active_session_id: str | None = None
    active_trial_id: str | None = None
    current_intent: Intent = Intent.NONE
    current_cue: str = "REST"
    runtime_state: RuntimeState = RuntimeState.IDLE
    safety_decision: SafetyDecision = SafetyDecision.STOP
    signal_quality: SignalQualityMetrics | None = None
    robot_state: RobotState | None = None
    obstacle_data: ObstacleData | None = None
    active_faults: list[str] = Field(default_factory=list)


class SimulationEngine:
    """Orchestrates deterministic simulation execution and event dispatch."""

    def __init__(
        self,
        config: SimulationConfig | None = None,
        dispatcher: EventDispatcher | None = None,
    ) -> None:
        self.config = config or SimulationConfig()
        self.dispatcher = dispatcher or default_dispatcher

        self.clock = SimulationClock(speed=self.config.time_scale)
        self.eeg_generator = SyntheticEEGGenerator(self.config)
        self.prediction_generator = SyntheticPredictionGenerator(self.config.seed)
        self.obstacle_simulator = ObstacleSimulator(self.config.seed)
        self.robot_simulator = RobotSimulator()
        self.fault_injector = FaultInjector()

        # Engine State
        self.active_scenario: SimulationScenario | None = None
        self.active_session: Session | None = None
        self.active_trial: Trial | None = None
        self.current_runtime_state: RuntimeState = RuntimeState.IDLE
        self.last_safety_decision: SafetyDecision = SafetyDecision.STOP
        self.last_intent: Intent = Intent.NONE
        self.current_cue: str = "REST"
        self.latest_chunk: EEGChunk | None = None

        self._async_task: asyncio.Task[None] | None = None
        self._on_chunk_callbacks: list[Callable[[EEGChunk], None]] = []

    def register_chunk_listener(self, callback: Callable[[EEGChunk], None]) -> None:
        """Register a callback invoked whenever an EEGChunk is generated."""
        self._on_chunk_callbacks.append(callback)

    def get_status(self) -> SimulationStatus:
        """Return full structured status snapshot of simulation engine."""
        sq = self.eeg_generator.compute_signal_quality()
        rb = self.robot_simulator.get_state()
        obs = self.obstacle_simulator.sample()

        return SimulationStatus(
            is_running=self.clock.is_running,
            is_paused=self.clock.mode == "PAUSED",
            mode=OperatingMode.SIMULATION,
            scenario_id=self.active_scenario.scenario_id if self.active_scenario else None,
            scenario_name=self.active_scenario.name if self.active_scenario else None,
            seed=self.config.seed,
            speed=self.clock.speed,
            elapsed_seconds=round(self.clock.elapsed_seconds(), 2),
            total_duration_seconds=self.active_scenario.duration_seconds
            if self.active_scenario
            else 0.0,
            active_session_id=self.active_session.session_id if self.active_session else None,
            active_trial_id=self.active_trial.trial_id if self.active_trial else None,
            current_intent=self.last_intent,
            current_cue=self.current_cue,
            runtime_state=self.current_runtime_state,
            safety_decision=self.last_safety_decision,
            signal_quality=sq,
            robot_state=rb,
            obstacle_data=obs,
            active_faults=self.fault_injector.active_faults(),
        )

    def start_scenario(
        self,
        scenario_id: str,
        seed: int | None = None,
        start_time: datetime | None = None,
    ) -> SimulationStatus:
        """Initialize and start a scenario synchronously or asynchronously."""
        scenario = get_scenario(scenario_id)
        if not scenario:
            raise ValueError(f"Unknown scenario ID '{scenario_id}'")

        if seed is not None:
            self.config.seed = seed
            self.eeg_generator = SyntheticEEGGenerator(self.config)
            self.prediction_generator = SyntheticPredictionGenerator(seed)
            self.obstacle_simulator = ObstacleSimulator(seed)

        self.active_scenario = scenario
        base_time = start_time or datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self.clock.reset(start_time=base_time)
        self.clock.start()

        self.robot_simulator.reset()
        self.obstacle_simulator.clear()
        self.fault_injector.clear()

        # 1. Create and dispatch SESSION_STARTED event
        now_iso = self.clock.now_iso()
        session_id = f"ses_sim_{self.config.seed}_{scenario.scenario_id}"
        self.active_session = Session(
            session_id=session_id,
            user_id="usr_sim_pilot01",
            mode=OperatingMode.SIMULATION,
            status=SessionStatus.ACTIVE,
            started_at=now_iso,
            source="neuromove.simulation",
            notes=f"Simulated Scenario: {scenario.name} (Seed: {self.config.seed})",
            metadata={"scenario_id": scenario.scenario_id, "seed": self.config.seed},
        )

        self.dispatcher.dispatch(
            EventType.SESSION_STARTED,
            SessionLifecyclePayload(
                session_id=session_id,
                user_id="usr_sim_pilot01",
                mode=OperatingMode.SIMULATION,
                status=SessionStatus.ACTIVE,
            ),
            session_id=session_id,
            mode=OperatingMode.SIMULATION,
            source="neuromove.simulation",
            timestamp=base_time,
        )

        self.current_runtime_state = RuntimeState.READY
        logger.info(
            "Simulation scenario '%s' started with session %s", scenario.scenario_id, session_id
        )
        return self.get_status()

    def pause(self) -> SimulationStatus:
        """Pause simulation clock."""
        self.clock.pause()
        logger.info("Simulation paused at %.2fs", self.clock.elapsed_seconds())
        return self.get_status()

    def resume(self) -> SimulationStatus:
        """Resume simulation clock."""
        self.clock.resume()
        logger.info("Simulation resumed at %.2fs", self.clock.elapsed_seconds())
        return self.get_status()

    def set_speed(self, speed: float) -> SimulationStatus:
        """Set simulation speed multiplier."""
        self.clock.set_speed(speed)
        return self.get_status()

    def stop(self) -> SimulationStatus:
        """Stop active simulation scenario."""
        if self._async_task and not self._async_task.done():
            self._async_task.cancel()
            self._async_task = None

        if self.active_session and self.active_session.status == SessionStatus.ACTIVE:
            now_iso = self.clock.now_iso()
            self.active_session = self.active_session.model_copy(
                update={"status": SessionStatus.COMPLETED, "ended_at": now_iso}
            )
            self.dispatcher.dispatch(
                EventType.SESSION_ENDED,
                SessionLifecyclePayload(
                    session_id=self.active_session.session_id,
                    user_id=self.active_session.user_id,
                    mode=OperatingMode.SIMULATION,
                    status=SessionStatus.COMPLETED,
                ),
                session_id=self.active_session.session_id,
                mode=OperatingMode.SIMULATION,
                source="neuromove.simulation",
                timestamp=self.clock.now(),
            )

        self.clock.pause()
        self.current_runtime_state = RuntimeState.IDLE
        self.last_safety_decision = SafetyDecision.STOP
        self.last_intent = Intent.NONE
        self.current_cue = "REST"
        self.active_scenario = None
        self.active_session = None
        self.active_trial = None
        logger.info("Simulation stopped.")
        return self.get_status()

    def reset(self) -> SimulationStatus:
        """Reset simulation engine state completely."""
        self.stop()
        self.clock.reset()
        self.robot_simulator.reset()
        self.obstacle_simulator.clear()
        self.fault_injector.clear()
        return self.get_status()

    def step(self, dt: float = 0.1) -> list[EventEnvelope]:
        """Advance simulation by dt seconds and emit deterministic canonical events."""
        if not self.active_scenario:
            return []

        t = self.clock.step(dt)
        elapsed = self.clock.elapsed_seconds()
        emitted_events: list[EventEnvelope] = []
        session_id = self.active_session.session_id if self.active_session else "ses_sim_default"

        # Determine active scenario step
        current_step: ScenarioStep = self.active_scenario.steps[0]
        for s in self.active_scenario.steps:
            if elapsed >= s.time_seconds:
                current_step = s

        self.current_cue = current_step.cue
        self.last_intent = current_step.target_intent
        self.eeg_generator.set_intent(current_step.target_intent)

        # Handle Faults / Disconnects
        if current_step.inject_fault == "EEG_DISCONNECT":
            self.eeg_generator.set_disconnected(True)
            self.fault_injector.inject(FaultType.EEG_DISCONNECT)
        elif current_step.inject_fault == "NOISY_EEG":
            self.eeg_generator.set_noise_multiplier(3.5)
            self.fault_injector.inject(FaultType.NOISY_EEG)
        else:
            self.eeg_generator.set_disconnected(False)
            self.eeg_generator.set_noise_multiplier(1.0)
            self.fault_injector.clear()

        # Handle Obstacles
        if current_step.obstacle_direction != "NONE":
            self.obstacle_simulator.set_obstacle(
                current_step.obstacle_direction, current_step.obstacle_distance_cm
            )  # type: ignore
        else:
            self.obstacle_simulator.clear()

        # Handle Emergency
        if current_step.trigger_emergency:
            self.current_runtime_state = RuntimeState.EMERGENCY
            self.last_safety_decision = SafetyDecision.STOP
            self.robot_simulator.emergency_stop_triggered = True
            evt = self.dispatcher.dispatch(
                EventType.EMERGENCY_STOP,
                SafetyAlertPayload(
                    severity=RiskLevel.CRITICAL,
                    alert_code="EMERGENCY_STOP",
                    message="Emergency stop triggered in simulation.",
                    requires_acknowledgement=True,
                ),
                session_id=session_id,
                mode=OperatingMode.SIMULATION,
                timestamp=t,
            )
            emitted_events.append(evt)

        # 1. Emit synthetic EEG Chunk (sample_rate_hz * dt samples)
        samples_count = max(1, int(self.config.sample_rate_hz * dt))
        chunk = self.eeg_generator.generate_samples(
            count=samples_count,
            timestamp=t,
            session_id=session_id,
            trial_id=self.active_trial.trial_id if self.active_trial else None,
        )
        self.latest_chunk = chunk
        for cb in self._on_chunk_callbacks:
            try:
                cb(chunk)
            except Exception as e:
                logger.warning("Error in chunk callback: %s", e)

        # 2. Emit Signal Quality event
        sq = self.eeg_generator.compute_signal_quality()
        sq_evt = self.dispatcher.dispatch(
            EventType.EEG_SIGNAL_QUALITY,
            SignalQualityPayload(
                quality_score=sq.overall_score,
                channels=sq.channels,
                dropped_samples=sq.dropped_samples,
                artifact_flags=sq.artifact_flags,
                sampling_rate=sq.sampling_rate_hz,
            ),
            session_id=session_id,
            mode=OperatingMode.SIMULATION,
            timestamp=t,
        )
        emitted_events.append(sq_evt)

        # 3. Emit Prediction event during imagery
        if "IMAGERY" in self.current_cue or self.last_intent != Intent.NONE:
            pred_payload = self.prediction_generator.generate_prediction(
                target_intent=self.last_intent,
                profile=current_step.confidence_profile,  # type: ignore
            )
            pred_evt = self.dispatcher.dispatch(
                EventType.PREDICTION,
                pred_payload,
                session_id=session_id,
                trial_id=self.active_trial.trial_id if self.active_trial else None,
                mode=OperatingMode.SIMULATION,
                timestamp=t,
            )
            emitted_events.append(pred_evt)

            # If high confidence, emit confirmed intent & arbitration
            if pred_payload.neural_confidence >= 0.70 and self.last_intent not in [
                Intent.NONE,
                Intent.UNCERTAIN,
            ]:
                self.current_runtime_state = RuntimeState.CONFIRMED
                conf_evt = self.dispatcher.dispatch(
                    EventType.INTENT_CONFIRMED,
                    IntentConfirmedPayload(
                        intent=self.last_intent,
                        confidence=pred_payload.neural_confidence,
                        confirmation_window_ms=500,
                        consecutive_epochs=3,
                    ),
                    session_id=session_id,
                    mode=OperatingMode.SIMULATION,
                    timestamp=t,
                )
                emitted_events.append(conf_evt)

                # Evaluate safety: if obstacle in direction, BLOCK, else APPROVE
                obs_data = self.obstacle_simulator.sample()
                is_blocked = (
                    (
                        self.last_intent == Intent.RIGHT
                        and obs_data.direction == "RIGHT"
                        and obs_data.obstacle_present
                    )
                    or (
                        self.last_intent == Intent.LEFT
                        and obs_data.direction == "LEFT"
                        and obs_data.obstacle_present
                    )
                    or (
                        self.last_intent == Intent.FORWARD
                        and obs_data.direction == "FRONT"
                        and obs_data.obstacle_present
                    )
                )

                if is_blocked:
                    self.last_safety_decision = SafetyDecision.BLOCKED
                    self.current_runtime_state = RuntimeState.BLOCKED
                    self.robot_simulator.apply_intent_command(self.last_intent, approved=False)
                    safe_evt = self.dispatcher.dispatch(
                        EventType.SAFETY_BLOCKED,
                        SafetyDecisionPayload(
                            decision=SafetyDecision.BLOCKED,
                            risk_level=RiskLevel.WARNING,
                            intent=self.last_intent,
                            neural_confidence=pred_payload.neural_confidence,
                            evaluated_at=t,
                            reason=f"Obstacle hazard detected in {obs_data.direction} sector ({obs_data.distance_cm} cm).",
                        ),
                        session_id=session_id,
                        mode=OperatingMode.SIMULATION,
                        timestamp=t,
                    )
                    emitted_events.append(safe_evt)
                else:
                    self.last_safety_decision = SafetyDecision.APPROVED
                    self.current_runtime_state = RuntimeState.EXECUTING
                    self.robot_simulator.apply_intent_command(self.last_intent, approved=True)
                    safe_evt = self.dispatcher.dispatch(
                        EventType.SAFETY_APPROVED,
                        SafetyDecisionPayload(
                            decision=SafetyDecision.APPROVED,
                            risk_level=RiskLevel.SAFE,
                            intent=self.last_intent,
                            neural_confidence=pred_payload.neural_confidence,
                            evaluated_at=t,
                            reason="Trajectory clear. Safe execution approved.",
                        ),
                        session_id=session_id,
                        mode=OperatingMode.SIMULATION,
                        timestamp=t,
                    )
                    emitted_events.append(safe_evt)

                    # Emit Robot Command
                    cmd_evt = self.dispatcher.dispatch(
                        EventType.ROBOT_COMMAND_APPROVED,
                        RobotCommandPayload(
                            command_id=f"cmd_sim_{self.dispatcher._sequence_counter:04d}",
                            intent=self.last_intent,
                            linear_velocity=self.robot_simulator.linear_velocity_mps,
                            angular_velocity=self.robot_simulator.angular_velocity_radps,
                            status=CommandStatus.APPROVED,
                            safety_decision=SafetyDecision.APPROVED,
                        ),
                        session_id=session_id,
                        mode=OperatingMode.SIMULATION,
                        timestamp=t,
                    )
                    emitted_events.append(cmd_evt)

        # 4. Step robot kinematics and emit Robot State
        self.robot_simulator.step(dt)
        rb_state = self.robot_simulator.get_state()
        rb_evt = self.dispatcher.dispatch(
            EventType.ROBOT_STATE,
            RobotStatePayload(
                connection_state=rb_state.connection_state,
                motion_state=rb_state.motion_state,
                heading=rb_state.heading_deg,
                battery=rb_state.battery_pct,
                left_motor=rb_state.left_motor_pwm,
                right_motor=rb_state.right_motor_pwm,
                linear_velocity=rb_state.linear_velocity_mps,
                angular_velocity=rb_state.angular_velocity_radps,
            ),
            session_id=session_id,
            mode=OperatingMode.SIMULATION,
            timestamp=t,
        )
        emitted_events.append(rb_evt)

        # Check scenario completion
        if elapsed >= self.active_scenario.duration_seconds:
            self.stop()

        return emitted_events

    def run_scenario_sync(
        self, scenario_id: str, seed: int = 42, step_dt: float = 0.1
    ) -> list[EventEnvelope]:
        """Deterministically execute an entire scenario synchronously and return all emitted events."""
        self.start_scenario(scenario_id, seed)
        all_events: list[EventEnvelope] = []
        if not self.active_scenario:
            return all_events

        steps_total = int(self.active_scenario.duration_seconds / step_dt) + 1
        for _ in range(steps_total):
            evts = self.step(step_dt)
            all_events.extend(evts)
            if not self.active_scenario:
                break

        return all_events


# Global default engine instance
simulation_engine = SimulationEngine()
