"use client";

import React from "react";
import { Compass, Wifi, Battery } from "lucide-react";
import { RobotState, ObstacleData } from "@neuromove/contracts";


interface DigitalTwinProps {
  robotState?: RobotState | null;
  obstacleData?: ObstacleData | null;
}

export function DigitalTwin({ robotState, obstacleData }: DigitalTwinProps) {
  const heading = robotState?.heading_deg ?? 0;
  const isConnected = robotState?.connection_state === "CONNECTED";
  const motionState = robotState?.motion_state ?? "IDLE";
  const batteryPct = robotState?.battery_pct ?? 0;
  const linearVel = robotState?.linear_velocity_mps ?? 0;
  const angularVel = robotState?.angular_velocity_radps ?? 0;

  const frontCm = obstacleData?.front_cm ?? 200;
  const leftCm = obstacleData?.left_cm ?? 200;
  const rightCm = obstacleData?.right_cm ?? 200;

  const frontHazard = frontCm < 60;
  const leftHazard = leftCm < 60;
  const rightHazard = rightCm < 60;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                2D Virtual Digital Twin
              </h3>
              <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 rounded">
                SIMULATION ONLY
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Simulated differential drive odometry and proximity telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <Wifi className="w-3 h-3" />
            {isConnected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Arena Canvas */}
      <div className="relative flex-1 min-h-[260px] bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
        {/* Arena Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

        {/* Proximity Obstacle Warning Indicators */}
        {/* Front Sensor */}
        <div
          className={`absolute top-3 flex flex-col items-center transition-all ${
            frontHazard ? "opacity-100 scale-105" : "opacity-75"
          }`}
        >
          <span
            className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded shadow-xs ${
              frontHazard
                ? "bg-red-500 text-white animate-pulse"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            FRONT: {frontCm.toFixed(0)} cm
          </span>
          {frontHazard && (
            <div className="w-12 h-6 border-b-2 border-red-500 bg-red-500/10 rounded-b-full mt-1" />
          )}
        </div>

        {/* Left Sensor */}
        <div
          className={`absolute left-3 flex items-center gap-1 transition-all ${
            leftHazard ? "opacity-100 scale-105" : "opacity-75"
          }`}
        >
          {leftHazard && (
            <div className="h-12 w-6 border-r-2 border-red-500 bg-red-500/10 rounded-r-full mr-1" />
          )}
          <span
            className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded shadow-xs ${
              leftHazard
                ? "bg-red-500 text-white animate-pulse"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            LEFT: {leftCm.toFixed(0)} cm
          </span>
        </div>

        {/* Right Sensor */}
        <div
          className={`absolute right-3 flex items-center gap-1 transition-all ${
            rightHazard ? "opacity-100 scale-105" : "opacity-75"
          }`}
        >
          <span
            className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded shadow-xs ${
              rightHazard
                ? "bg-red-500 text-white animate-pulse"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            RIGHT: {rightCm.toFixed(0)} cm
          </span>
          {rightHazard && (
            <div className="h-12 w-6 border-l-2 border-red-500 bg-red-500/10 rounded-l-full ml-1" />
          )}
        </div>

        {/* Robot Chassis Graphic */}
        <div
          className="relative z-10 transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          {/* Chassis Box */}
          <div className="w-24 h-32 bg-white border-2 border-slate-700 rounded-xl shadow-md flex flex-col items-center justify-between p-2 relative">
            {/* Heading Arrow Pointer */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-blue-600 -mt-1" />

            {/* Center Hub Indicator */}
            <div className="flex flex-col items-center">
              <span className="text-2xs font-bold text-slate-800 tracking-wider">
                NEUROMOVE
              </span>
              <span className="text-3xs font-mono text-slate-500">
                {heading.toFixed(0)}°
              </span>
            </div>

            {/* Motion Status Pill */}
            <div className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-slate-100 text-slate-700 uppercase">
              {motionState}
            </div>

            {/* Left Wheel */}
            <div
              className={`absolute -left-3 top-8 w-2.5 h-14 rounded-sm border border-slate-800 transition-colors ${
                (robotState?.left_motor_pwm ?? 0) !== 0
                  ? "bg-blue-600 animate-pulse"
                  : "bg-slate-700"
              }`}
            />
            {/* Right Wheel */}
            <div
              className={`absolute -right-3 top-8 w-2.5 h-14 rounded-sm border border-slate-800 transition-colors ${
                (robotState?.right_motor_pwm ?? 0) !== 0
                  ? "bg-blue-600 animate-pulse"
                  : "bg-slate-700"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Telemetry Metrics Footer */}
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
        <div className="p-2 bg-slate-50 rounded-lg">
          <span className="block text-2xs text-slate-500 font-medium">
            HEADING
          </span>
          <span className="text-xs font-mono font-bold text-slate-800">
            {heading.toFixed(1)}°
          </span>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <span className="block text-2xs text-slate-500 font-medium">
            VELOCITY
          </span>
          <span className="text-xs font-mono font-bold text-slate-800">
            {linearVel.toFixed(2)} m/s
          </span>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <span className="block text-2xs text-slate-500 font-medium">
            ANGULAR
          </span>
          <span className="text-xs font-mono font-bold text-slate-800">
            {angularVel.toFixed(2)} rad/s
          </span>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <span className="block text-2xs text-slate-500 font-medium">
            BATTERY
          </span>
          <span className="text-xs font-mono font-bold text-slate-800 flex items-center justify-center gap-1">
            <Battery className="w-3 h-3 text-slate-600" />
            {batteryPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
