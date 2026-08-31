import {
  SystemStatus,
  SystemStatusSchema,
  SafetyState,
  SafetyStateSchema,
  RobotState,
  RobotStateSchema,
  EmergencyStopResponse,
  EmergencyStopResponseSchema,
} from "@neuromove/contracts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/system/status`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return SystemStatusSchema.parse(data);
  } catch {
    // Fallback safe simulation shell status if local backend is offline
    return {
      service: "neuromove-core",
      status: "offline",
      version: "0.1.0",
      mode: "SIMULATION",
      timestamp: new Date().toISOString(),
      components: {
        api: "unavailable",
        database: "not_initialized",
        eeg: "not_connected",
        robot: "not_connected",
        safety: "ready",
      },
    };
  }
}

export async function fetchSafetyState(): Promise<SafetyState> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/safety/state`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return SafetyStateSchema.parse(data);
  } catch {
    return {
      runtime_state: "IDLE",
      last_decision: "STOP",
      risk_level: "SAFE",
      emergency_active: false,
      fault_code: null,
      reason_code: "SYS_IDLE",
      reason: "Safe local fallback default.",
      updated_at: new Date().toISOString(),
    };
  }
}

export async function fetchRobotState(): Promise<RobotState> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/robot/state`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return RobotStateSchema.parse(data);
  } catch {
    return {
      connection_state: "DISCONNECTED",
      motion_state: "STOPPED",
      heading_deg: 0,
      battery_pct: 0,
      left_motor_pwm: 0,
      right_motor_pwm: 0,
      linear_velocity_mps: 0,
      angular_velocity_radps: 0,
      emergency_stop_triggered: false,
      last_heartbeat: null,
      mode: "SIMULATION",
    };
  }
}

export async function triggerEmergencyStop(): Promise<EmergencyStopResponse> {
  const res = await fetch(`${API_BASE_URL}/api/emergency/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EmergencyStopResponseSchema.parse(data);
}
