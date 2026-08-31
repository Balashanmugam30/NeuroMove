import {
  SystemStatus,
  SystemStatusSchema,
  SafetyState,
  SafetyStateSchema,
  RobotState,
  RobotStateSchema,
  EmergencyStopResponse,
  EmergencyStopResponseSchema,
  SimulationStatus,
  SimulationStatusSchema,
  SimulationScenario,
  SimulationScenarioSchema,
} from "@neuromove/contracts";
import { z } from "zod";

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

// --- Simulation Engine API Operations (Phase 03) ---

export async function fetchSimulationStatus(): Promise<SimulationStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/simulation/status`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return SimulationStatusSchema.parse(data);
  } catch {
    return {
      is_running: false,
      is_paused: false,
      mode: "SIMULATION",
      scenario_id: "right-turn",
      scenario_name: "2. Right Turn Motor Imagery",
      seed: 42,
      speed: 1.0,
      elapsed_seconds: 0,
      total_duration_seconds: 10,
      current_intent: "NONE",
      current_cue: "REST",
      runtime_state: "IDLE",
      safety_decision: "STOP",
      active_faults: [],
    };
  }
}

export async function fetchSimulationScenarios(): Promise<SimulationScenario[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/simulation/scenarios`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return z.array(SimulationScenarioSchema).parse(data);
  } catch {
    return [
      {
        scenario_id: "idle",
        name: "1. Baseline Idle & Rest",
        description: "Continuous baseline resting state with zero obstacles.",
        seed: 42,
        duration_seconds: 8,
        trials_count: 1,
        expected_behavior: "Safe IDLE state.",
        steps: [],
      },
      {
        scenario_id: "right-turn",
        name: "2. Right Turn Motor Imagery",
        description: "Standard Graz trial: Fixation -> Right Cue -> High confidence RIGHT.",
        seed: 42,
        duration_seconds: 10,
        trials_count: 1,
        expected_behavior: "Confirmed RIGHT intent.",
        steps: [],
      },
    ];
  }
}

export async function startSimulation(
  scenario_id: string,
  seed?: number,
  speed?: number
): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id, seed, speed }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function pauseSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/pause`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function resumeSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/resume`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function setSimulationSpeed(speed: number): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/speed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function stopSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function resetSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/reset`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}
