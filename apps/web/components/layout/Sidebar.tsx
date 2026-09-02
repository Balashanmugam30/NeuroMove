"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Waves,
  Crosshair,
  BrainCircuit,
  ShieldCheck,
  Bot,
  History,
  FlaskConical,
  BarChart3,
  BookOpen,
  Settings,
  Database,
  Sliders,
  X,
  GitBranch,
  Gauge,
  Workflow,
  ShieldAlert,
  Radio,
  Cpu,
  Layers,
} from "lucide-react";


import { cn } from "@/lib/utils";

export interface NavGroup {
  name: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    name: "Overview",
    items: [
      { href: "/overview", label: "System Overview", icon: LayoutDashboard },
    ],
  },
  {
    name: "Control Station",
    items: [
      { href: "/live", label: "Live Control", icon: Activity, badge: "Phase 06" },
      { href: "/robot", label: "Robot Mobility", icon: Bot },
    ],
  },
  {
    name: "BCI Pipeline",
    items: [
      { href: "/eeg", label: "EEG Lab", icon: Waves },
      { href: "/eeg/live", label: "Live EEG Acquisition", icon: Activity, badge: "Phase 21" },
      { href: "/sensors", label: "Multimodal Sensors", icon: Layers, badge: "Phase 23" },
      { href: "/eeg/preprocessing", label: "Preprocessing & DSP", icon: Sliders, badge: "Phase 09" },
      { href: "/eeg/features", label: "Epochs & Features", icon: BrainCircuit, badge: "Phase 10" },
      { href: "/calibration", label: "Calibration", icon: Crosshair, badge: "Phase 13" },
      { href: "/models", label: "CSP & Models", icon: BrainCircuit, badge: "Phase 11" },
      { href: "/models/lab", label: "AI Model Lab", icon: FlaskConical, badge: "Phase 12" },
      { href: "/adaptation", label: "Adaptive Updates", icon: GitBranch, badge: "Phase 14" },
      { href: "/confidence", label: "Confidence & Temporal", icon: Gauge, badge: "Phase 15" },
      { href: "/intent", label: "Intent State Machine", icon: Workflow, badge: "Phase 16" },
    ],
  },


  {
    name: "Safety & Reliability",
    items: [
      { href: "/safety", label: "Safety Arbitration", icon: ShieldCheck, badge: "Phase 17" },
      { href: "/resilience", label: "Resilience Lab", icon: ShieldAlert, badge: "Phase 18" },
      { href: "/transport", label: "Command Transport", icon: Radio, badge: "Phase 19" },
      { href: "/hardware", label: "Hardware HIL Lab", icon: Cpu, badge: "Phase 20" },
    ],
  },
  {
    name: "Research & Evidence",
    items: [
      { href: "/research/datasets", label: "Public Datasets", icon: Database, badge: "Phase 08" },
      { href: "/sessions", label: "Sessions", icon: History },
      { href: "/research", label: "Research Lab", icon: FlaskConical, badge: "Phase 22" },
      { href: "/results", label: "Evidence & Results", icon: BarChart3 },
    ],
  },
  {
    name: "System",
    items: [
      { href: "/docs", label: "Documentation", icon: BookOpen },
      { href: "/system", label: "System Diagnostics", icon: Settings },
    ],
  },
];

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const sidebarContent = (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 h-full overflow-y-auto font-sans">
      <div className="p-4 space-y-6">
        {/* Mobile Header */}
        {onClose && (
          <div className="md:hidden flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">Navigation Menu</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {NAV_GROUPS.map((group) => (
          <div key={group.name} className="space-y-1">
            <div className="px-3 py-1 text-2xs font-bold uppercase tracking-wider text-slate-400 font-sans">
              {group.name}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === "/overview" && pathname === "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all select-none",
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-blue-600" : "text-slate-400"
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer System Status Banner */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 text-xs font-sans text-slate-500">
        <div className="flex items-center justify-between font-medium">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
            LOCAL PIPELINE
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-2xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AIR-GAPPED
          </span>
        </div>
        <div className="text-2xs text-slate-400 mt-1">
          FastAPI Core @ 127.0.0.1:8000
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block min-h-[calc(100vh-4rem)] shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-10 shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
