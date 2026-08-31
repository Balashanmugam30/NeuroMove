"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bot } from "lucide-react";
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
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Robot Mobility Platform & ESP32 Protocol
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
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
          title={`Robot Link: ${robotState?.connection_state || "DISCONNECTED"} (SIMULATION Mode)`}
          description="Canonical RobotState and RobotCommand contracts active. ESP32 serial communication protocol and hardware drivers will be linked in hardware phases."
          icon={<Bot className="w-6 h-6 text-slate-400" />}
        />
      </SectionCard>
    </div>
  );
}
