"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { DigitalTwin } from "@/components/simulation/DigitalTwin";
import { fetchRobotState } from "@/lib/api-client";
import { RobotState } from "@neuromove/contracts";
import { Bot, Compass, Gauge, Battery, Activity } from "lucide-react";

export default function RobotMobilityPage() {
  const { operatingMode } = useMode();
  const { connectionState, latestSnapshot, freshness } = useRealtime();
  const [robotState, setRobotState] = useState<RobotState>({
    connection_state: "DISCONNECTED",
    motion_state: "STOPPED",
    heading_deg: 0,
    battery_pct: 95,
    left_motor_pwm: 0,
    right_motor_pwm: 0,
    linear_velocity_mps: 0,
    angular_velocity_radps: 0,
    emergency_stop_triggered: false,
    last_heartbeat: null,
    mode: "SIMULATION",
  });

  // Absorb snapshot
  useEffect(() => {
    if (latestSnapshot?.robot_state) {
      setRobotState(latestSnapshot.robot_state);
    }
  }, [latestSnapshot]);

  // Subscribe to real-time robot stream
  useRealtimeStream("robot", (msg) => {
    if (msg.event?.payload) {
      setRobotState((prev) => ({
        ...prev,
        ...(msg.event?.payload as any),
      }));
    }
  });

  useEffect(() => {
    fetchRobotState()
      .then((st) => setRobotState(st))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              Robot Mobility Platform & ESP32 Telemetry
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              SIMULATION
            </span>
          </div>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Differential drive motor translation, serial packet verification, and real-time odometry stream.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Connection State"
          value={robotState.connection_state}
          subtitle={`Transport: ${connectionState} (${freshness})`}
          variant={robotState.connection_state === "CONNECTED" ? "safe" : "default"}
          icon={<Bot className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Heading Orientation"
          value={`${robotState.heading_deg.toFixed(1)}°`}
          subtitle="Relative yaw angle"
          icon={<Compass className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Linear Velocity"
          value={`${robotState.linear_velocity_mps.toFixed(2)} m/s`}
          subtitle={`Angular: ${robotState.angular_velocity_radps.toFixed(2)} rad/s`}
          icon={<Gauge className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Battery Telemetry"
          value={`${robotState.battery_pct.toFixed(0)}%`}
          subtitle="Simulated voltage 12.4V"
          variant={robotState.battery_pct < 20 ? "danger" : "safe"}
          icon={<Battery className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* 2D Digital Twin & Motor Actuation Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <DigitalTwin robotState={robotState} />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <SectionCard
            title="Differential Motor Actuation"
            description="Left & Right PWM motor driver channels"
          >
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Left Motor (PWM)</span>
                  <span className="font-mono font-bold text-blue-600">
                    {robotState.left_motor_pwm} / 255
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-200"
                    style={{
                      width: `${Math.min(100, Math.abs(robotState.left_motor_pwm / 255) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Right Motor (PWM)</span>
                  <span className="font-mono font-bold text-teal-600">
                    {robotState.right_motor_pwm} / 255
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-600 h-full transition-all duration-200"
                    style={{
                      width: `${Math.min(100, Math.abs(robotState.right_motor_pwm / 255) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Real-time robot telemetry transported over <code>/ws/robot</code> stream.
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
