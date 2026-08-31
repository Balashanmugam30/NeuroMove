"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bot, Radio, Zap } from "lucide-react";
import { fetchRobotState } from "@/lib/api-client";

export default function RobotMobilityPage() {
  const { operatingMode } = useMode();
  const [robotState, setRobotState] = useState<any>(null);

  useEffect(() => {
    fetchRobotState()
      .then(setRobotState)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            Robot Mobility Platform & ESP32 Protocol
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Differential drive motor translation, serial packet CRC16
            verification, and hardware heartbeats.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Physical Hardware Interface"
        description="ESP32 motor driver link status, battery voltage, and velocity telemetry"
      >
        <EmptyState
          title="Robot Disconnected"
          description="Phase 01 foundation active in SIMULATION mode. ESP32 serial communication protocol and hardware drivers will be linked in Phase 05."
          icon={<Bot className="w-6 h-6 text-slate-400" />}
        />
      </SectionCard>
    </div>
  );
}
