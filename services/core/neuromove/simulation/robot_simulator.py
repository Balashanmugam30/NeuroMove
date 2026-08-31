"""NeuroMove Virtual 2D Robot Simulator.

Simulates differential drive kinematics, heading, odometry, and motor telemetry.
DISCLAIMER: This simulator is purely virtual and does NOT actuate physical motors.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime

from neuromove.domain.enums import ConnectionState, Intent, OperatingMode
from neuromove.domain.models import RobotState


class RobotSimulator:
    """Simulates virtual 2D robot kinematics and state telemetry."""

    def __init__(self) -> None:
        self.x: float = 0.0
        self.y: float = 0.0
        self.heading_deg: float = 0.0
        self.linear_velocity_mps: float = 0.0
        self.angular_velocity_radps: float = 0.0
        self.motion_state: str = "IDLE"
        self.battery_pct: float = 94.0
        self.left_motor_pwm: int = 0
        self.right_motor_pwm: int = 0
        self.connection_state: ConnectionState = ConnectionState.CONNECTED
        self.emergency_stop_triggered: bool = False

    def reset(self) -> None:
        """Reset virtual position and kinematics."""
        self.x = 0.0
        self.y = 0.0
        self.heading_deg = 0.0
        self.linear_velocity_mps = 0.0
        self.angular_velocity_radps = 0.0
        self.motion_state = "IDLE"
        self.battery_pct = 94.0
        self.left_motor_pwm = 0
        self.right_motor_pwm = 0
        self.connection_state = ConnectionState.CONNECTED
        self.emergency_stop_triggered = False

    def apply_intent_command(self, intent: Intent, approved: bool = True) -> None:
        """Apply a simulated actuation command based on intent arbitration."""
        if (
            self.emergency_stop_triggered
            or self.connection_state == ConnectionState.DISCONNECTED
            or not approved
        ):
            self.linear_velocity_mps = 0.0
            self.angular_velocity_radps = 0.0
            self.left_motor_pwm = 0
            self.right_motor_pwm = 0
            self.motion_state = "STOPPED" if not self.emergency_stop_triggered else "EMERGENCY"
            return

        if intent == Intent.FORWARD:
            self.linear_velocity_mps = 0.25
            self.angular_velocity_radps = 0.0
            self.left_motor_pwm = 180
            self.right_motor_pwm = 180
            self.motion_state = "FORWARD"
        elif intent == Intent.LEFT:
            self.linear_velocity_mps = 0.08
            self.angular_velocity_radps = 0.45
            self.left_motor_pwm = -120
            self.right_motor_pwm = 120
            self.motion_state = "LEFT"
        elif intent == Intent.RIGHT:
            self.linear_velocity_mps = 0.08
            self.angular_velocity_radps = -0.45
            self.left_motor_pwm = 120
            self.right_motor_pwm = -120
            self.motion_state = "RIGHT"
        elif intent == Intent.BACKWARD:
            self.linear_velocity_mps = -0.15
            self.angular_velocity_radps = 0.0
            self.left_motor_pwm = -140
            self.right_motor_pwm = -140
            self.motion_state = "BACKWARD"
        else:
            self.linear_velocity_mps = 0.0
            self.angular_velocity_radps = 0.0
            self.left_motor_pwm = 0
            self.right_motor_pwm = 0
            self.motion_state = "IDLE"

    def step(self, dt_seconds: float = 0.1) -> None:
        """Step virtual kinematic position forward."""
        if self.motion_state not in ["STOPPED", "IDLE", "EMERGENCY", "FAULT"]:
            # Update heading
            self.heading_deg = (
                self.heading_deg + math.degrees(self.angular_velocity_radps * dt_seconds)
            ) % 360.0
            rad = math.radians(self.heading_deg)
            dist = self.linear_velocity_mps * dt_seconds
            self.x += dist * math.cos(rad)
            self.y += dist * math.sin(rad)
            # Battery subtle discharge
            self.battery_pct = max(5.0, round(self.battery_pct - 0.001 * dt_seconds, 2))

    def get_state(self) -> RobotState:
        """Return canonical RobotState model."""
        now_str = datetime.now(UTC).isoformat()
        return RobotState(
            connection_state=self.connection_state,
            motion_state=self.motion_state,
            heading_deg=round(self.heading_deg, 1),
            battery_pct=round(self.battery_pct, 1),
            left_motor_pwm=self.left_motor_pwm,
            right_motor_pwm=self.right_motor_pwm,
            linear_velocity_mps=round(self.linear_velocity_mps, 2),
            angular_velocity_radps=round(self.angular_velocity_radps, 2),
            emergency_stop_triggered=self.emergency_stop_triggered,
            last_heartbeat=now_str,
            mode=OperatingMode.SIMULATION,
        )
