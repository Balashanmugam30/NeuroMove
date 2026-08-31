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
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/live", label: "Live Control", icon: Activity },
  { href: "/eeg", label: "EEG Lab", icon: Waves },
  { href: "/calibration", label: "Calibration", icon: Crosshair },
  { href: "/models", label: "AI Models", icon: BrainCircuit },
  { href: "/safety", label: "Safety Engine", icon: ShieldCheck },
  { href: "/robot", label: "Robot Mobility", icon: Bot },
  { href: "/sessions", label: "Sessions", icon: History },
  { href: "/research", label: "Research Lab", icon: BarChart3 },
  { href: "/results", label: "Results", icon: FileText },
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/system", label: "System", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-sans">
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
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all",
                isActive
                  ? "bg-blue-50 border border-blue-100 text-blue-700 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-blue-600" : "text-slate-400",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/70 text-xs font-sans text-slate-500">
        <div className="flex items-center justify-between font-medium">
          <span>PIPELINE</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ONLINE
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          Local Control Station (Air-Gapped)
        </div>
      </div>
    </aside>
  );
}
