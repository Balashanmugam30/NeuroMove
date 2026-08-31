# NeuroMove Visual Design System 2.0

## 1. Design Philosophy & North Star
NeuroMove is a research-grade Brain-Computer Interface (BCI) mobility platform. The visual identity reflects scientific rigor, medical-grade reliability, and calm precision.

- **Aesthetic**: Bright, professional, premium health-tech, research-grade, modern.
- **Explicit Anti-Patterns**: Dark hacker cyberpunk terminals, neon glows, gaming HUD elements, decorative particles.

---

## 2. Color Palette & Semantic Roles

### Foundation Surfaces
- **Canvas / Background**: `#F8FAFC` (`--background`)
- **Card Surface**: `#FFFFFF` (`--surface`)
- **Secondary Surface**: `#F1F5F9` (`--surface-alt`)
- **Structural Borders**: `#E2E8F0` (Default), `#CBD5E1` (Strong)

### Typography
- **Primary Text**: `#0F172A` (`--text-primary`) — Titles, primary labels, core metrics.
- **Secondary Text**: `#475569` (`--text-secondary`) — Explanatory copy, subtitles.
- **Muted Text**: `#64748B` (`--text-muted`) — Table column headers, helper labels.
- **Disabled Text**: `#94A3B8` (`--text-disabled`) — Disabled controls.

### Brand Blue (Primary Action & Accent)
- **Base / Action**: `#2563EB` (`--color-brand`)
- **Hover**: `#1D4ED8` (`--color-brand-hover`)
- **Active**: `#1E40AF` (`--color-brand-active`)
- **Soft Tint**: `#EFF6FF` (`--color-brand-soft`)
- **Subtle Border**: `#DBEAFE` (`--color-brand-subtle`)

### Biomedical Teal (Electrophysiology & Spectral Accent)
- **Base**: `#0D9488` (`--color-accent`)
- **Hover**: `#0F766E` (`--color-accent-hover`)
- **Soft Tint**: `#F0FDFA` (`--color-accent-soft`)
- **Subtle Border**: `#CCFBF1` (`--color-accent-subtle`)

### Semantic Status
- **Success (Approved / Safe / Nominal)**: `#15803D` / `#F0FDF4` / `#DCFCE7`
- **Warning (Candidate / Degraded / Caution)**: `#B45309` / `#FFFBEB` / `#FEF3C7`
- **Danger (Blocked / Emergency / Fault)**: `#DC2626` / `#FEF2F2` / `#FEE2E2`

---

## 3. Multi-Channel Status Rule
Color is **never** the sole indicator of status. Every status component combines:
1. Shape symbol / Icon (`●`, `▶`, `▲`, `■`, `○`)
2. Clear textual label (`APPROVED`, `BLOCKED`, `STOP`, `CONNECTED`, `DEGRADED`)
3. Semantic foreground & background tint

---

## 4. Typography Scale & Hierarchy
- **Display**: 32px / 2rem, bold, `-0.02em` letter spacing.
- **H1**: 20px / 1.25rem, bold, `-0.015em` letter spacing.
- **H2**: 18px / 1.125rem, semibold, `-0.01em` letter spacing.
- **H3**: 14px / 0.875rem, semibold.
- **Section**: 11px / 0.6875rem, semibold uppercase, `+0.05em` letter spacing.
- **Body**: 14px / 0.875rem, regular, `1.5` line height.
- **Body Small**: 12px / 0.75rem, regular.
- **Caption**: 11px / 0.6875rem, medium.
- **Code / Monospace**: JetBrains Mono / ui-monospace for timestamps, IDs, sequence numbers, and mathematical parameters.
