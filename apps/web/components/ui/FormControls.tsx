"use client";

import React, {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  forwardRef,
} from "react";
import { cn } from "@/lib/utils";

// --- Form Input ---
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="space-y-1 text-left w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-1.5 text-xs font-sans rounded-lg border bg-white text-slate-900 transition-all placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500",
            error
              ? "border-red-300 focus-visible:ring-red-500 bg-red-50/30"
              : "border-slate-200 hover:border-slate-300 focus-visible:border-blue-500",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-2xs font-medium text-red-600">{error}</p>
        ) : (
          helperText && (
            <p className="text-2xs text-slate-400">{helperText}</p>
          )
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// --- Form Select ---
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helperText, error, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="space-y-1 text-left w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full px-3 py-1.5 text-xs font-sans rounded-lg border bg-white text-slate-900 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer",
            error
              ? "border-red-300 focus-visible:ring-red-500"
              : "border-slate-200 hover:border-slate-300 focus-visible:border-blue-500",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-2xs font-medium text-red-600">{error}</p>
        ) : (
          helperText && (
            <p className="text-2xs text-slate-400">{helperText}</p>
          )
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

// --- Segmented Control ---
export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  size?: "xs" | "sm";
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 items-center select-none",
        className
      )}
      role="radiogroup"
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 font-semibold rounded-md transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500",
              size === "xs" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
              isSelected
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Toggle Switch ---
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center justify-between gap-3 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {(label || description) && (
        <div className="space-y-0.5">
          {label && (
            <span className="block text-xs font-semibold text-slate-800">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-2xs text-slate-500">{description}</span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500",
          checked ? "bg-blue-600" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}
