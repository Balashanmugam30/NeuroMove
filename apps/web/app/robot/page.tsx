"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { DigitalTwin } from "@/components/simulation/DigitalTwin";
import { Notice } from "@/components/ui/Notice";
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
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Control Station"
        title="Robot Mobility Platform & ESP32 Telemetry"
        description="Differential drive motor actuation translation, serial packet verification, and real-time odometry stream."
        mode={operatingMode}
      />

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
            description="Left & Right PWM motor driver output channels"
          >
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Left Motor Channel (PWM)</span>
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
                  <span className="font-semibold text-slate-700">Right Motor Channel (PWM)</span>
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

              <Notice variant="info" icon={<Activity className="w-4 h-4 text-blue-600 shrink-0" />}>
                Real-time robot telemetry transported over dedicated <code className="text-code">/ws/robot</code> stream.
              </Notice>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
