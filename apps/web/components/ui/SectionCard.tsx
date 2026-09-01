import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  badge,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all",
        className,
      )}
    >
      {(title || action || badge) && (
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 font-sans">
                  {title}
                </h3>
              )}
              {badge && <div>{badge}</div>}
            </div>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                {description}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
