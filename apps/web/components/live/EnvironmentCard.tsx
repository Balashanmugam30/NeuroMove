"use client";

import React from "react";
import { ObstacleData } from "@neuromove/contracts";
import { Radar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvironmentCardProps {
  obstacleData?: ObstacleData | null;
  className?: string;
}

export function EnvironmentCard({
  obstacleData,
  className,
}: EnvironmentCardProps) {
  const frontCm = obstacleData?.front_cm ?? 200;
  const leftCm = obstacleData?.left_cm ?? 200;
  const rightCm = obstacleData?.right_cm ?? 200;
  const isObstaclePresent = obstacleData?.obstacle_present ?? false;
  const obstacleDir = obstacleData?.direction ?? "NONE";

  const getDistanceTier = (dist: number) => {
    if (dist < 45) {
      return {
        text: "CRITICAL HAZARD",
        color: "text-red-700 bg-red-50 border-red-200",
        hazard: true,
      };
    }
    if (dist < 75) {
      return {
        text: "PROXIMITY CAUTION",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        hazard: true,
      };
    }
    return {
      text: "CLEAR PATH",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      hazard: false,
    };
  };

  const frontTier = getDistanceTier(frontCm);
  const leftTier = getDistanceTier(leftCm);
  const rightTier = getDistanceTier(rightCm);

  return (
    <div
      data-testid="environment-card"
      className={cn(
        "p-4 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Radar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Environment Perception
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Ultrasonic proximity perimeter scan
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            SIMULATED PROXIMITY
          </span>
        </div>

        {/* Global Obstacle Status Banner */}
        <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Perimeter Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border",
                  isObstaclePresent
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}
              >
                {isObstaclePresent ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {isObstaclePresent
                  ? `OBSTACLE DETECTED (${obstacleDir})`
                  : "PERIMETER SECURE"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Min Distance
            </span>
            <span className="text-lg font-bold font-mono text-slate-900">
              {Math.min(frontCm, leftCm, rightCm).toFixed(0)} cm
            </span>
          </div>
        </div>

        {/* 3-Sector Distance Radar Readouts */}
        <div className="mt-3 space-y-1.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            Sector Proximity Zones
          </span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            {/* Left */}
            <div
              className={cn(
                "p-2 rounded-lg border flex flex-col justify-between",
                leftTier.color
              )}
            >
              <span className="text-2xs font-bold block opacity-80">LEFT</span>
              <span className="text-sm font-bold my-0.5">
                {leftCm.toFixed(0)} cm
              </span>
              <span className="text-3xs font-medium block truncate">
                {leftTier.text}
              </span>
            </div>

            {/* Front */}
            <div
              className={cn(
                "p-2 rounded-lg border flex flex-col justify-between",
                frontTier.color
              )}
            >
              <span className="text-2xs font-bold block opacity-80">FRONT</span>
              <span className="text-sm font-bold my-0.5">
                {frontCm.toFixed(0)} cm
              </span>
              <span className="text-3xs font-medium block truncate">
                {frontTier.text}
              </span>
            </div>

            {/* Right */}
            <div
              className={cn(
                "p-2 rounded-lg border flex flex-col justify-between",
                rightTier.color
              )}
            >
              <span className="text-2xs font-bold block opacity-80">RIGHT</span>
              <span className="text-sm font-bold my-0.5">
                {rightCm.toFixed(0)} cm
              </span>
              <span className="text-3xs font-medium block truncate">
                {rightTier.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Clearance Footnote */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span>Stop Threshold: &lt;45 cm</span>
        <span>Warning: &lt;75 cm</span>
      </div>
    </div>
  );
}
