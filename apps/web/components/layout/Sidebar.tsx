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
  FileText,
  BarChart3,
  Terminal,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/live", label: "Live Control", icon: Activity },
  { href: "/eeg", label: "EEG Stream", icon: Waves },
  { href: "/calibration", label: "Calibration", icon: Crosshair },
  { href: "/models", label: "Models & CSP", icon: BrainCircuit },
  { href: "/safety", label: "Safety Engine", icon: ShieldCheck },
  { href: "/robot", label: "Robot Mobility", icon: Bot },
  { href: "/sessions", label: "Sessions", icon: History },
  { href: "/research", label: "Research", icon: BarChart3 },
  { href: "/results", label: "Results", icon: FileText },
  { href: "/docs", label: "Architecture Docs", icon: Terminal },
  { href: "/system", label: "System Diagnostics", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
          Navigation Architecture
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href === "/overview" && pathname === "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-mono transition-all",
                isActive
                  ? "bg-blue-950/60 border border-blue-800/60 text-blue-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-blue-400" : "text-slate-400",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
        <div className="flex items-center justify-between">
          <span>PIPELINE</span>
          <span className="text-emerald-400 font-semibold">ONLINE</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          Local Control Station
        </div>
      </div>
    </aside>
  );
}
