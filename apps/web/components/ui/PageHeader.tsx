"use client";

import React, { ReactNode } from "react";
import { ModeBadge } from "./ModeBadge";
import { OperatingMode } from "@neuromove/contracts";

interface PageHeaderProps {
  category?: string;
  title: string;
  description?: string;
  mode?: OperatingMode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  category,
  title,
  description,
  mode,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {category && (
            <span className="px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
              {category}
            </span>
          )}
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            {title}
          </h1>
          {mode && <ModeBadge mode={mode} />}
        </div>
        {description && (
          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
