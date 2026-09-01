import React from "react";
import { cn } from "@/lib/utils";

interface BadgeObject {
  label: string;
  variant?: "brand" | "neutral" | "success" | "warning" | "danger" | string;
}

interface SectionCardProps {
  title?: string;
  description?: string;
  badge?: React.ReactNode | BadgeObject;
  action?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  badge,
  action,
  headerActions,
  children,
  className,
}: SectionCardProps) {
  const renderBadge = () => {
    if (!badge) return null;
    if (React.isValidElement(badge) || typeof badge === "string" || typeof badge === "number") {
      return <div>{badge}</div>;
    }
    const b = badge as BadgeObject;
    if (b && typeof b === "object" && "label" in b) {
      const isBrand = b.variant === "brand";
      return (
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
            isBrand
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-slate-100 text-slate-700 border-slate-200"
          )}
        >
          {b.label}
        </span>
      );
    }
    return null;
  };

  const actualAction = action || headerActions;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all",
        className,
      )}
    >
      {(title || actualAction || badge) && (
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 font-sans">
                  {title}
                </h3>
              )}
              {renderBadge()}
            </div>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                {description}
              </p>
            )}
          </div>
          {actualAction && <div>{actualAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
