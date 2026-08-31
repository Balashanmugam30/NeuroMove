# NeuroMove Visual Design System

## 1. Design Philosophy

NeuroMove is a research-grade neurotechnology platform and medical-engineering command station. The visual identity reflects **clean scientific precision**, **accessible medical ergonomics**, and **high-end health-tech SaaS aesthetics** (inspired by modern med-tech and Apple Health).

---

## 2. Core Color Palette

### Primary Brand / Action Blue

Used for primary actions, active navigation, links, and selected states.

- **Primary 500 (`#2563EB`)**: Main action & brand color.
- **Primary 600 (`#1D4ED8`)**: Hover & active interaction state.
- **Primary 700 (`#1E40AF`)**: Deep contrast element.
- **Primary 100 (`#DBEAFE`)**: Subtle pill border & highlight.
- **Primary 50 (`#EFF6FF`)**: Active row & soft background.

### Supporting Biomedical Teal

Used sparingly as a secondary accent for electrophysiological signals and spectral charts.

- **Teal 600 (`#0F766E`)**
- **Teal 500 (`#0D9488`)**
- **Teal 400 (`#14B8A6`)**
- **Teal 100 (`#CCFBF1`)**
- **Teal 50 (`#F0FDFA`)**

### Light Foundation Neutrals

The dominant foundation (70–80% visual area).

- **Background Canvas**: `#F8FAFC` (Slate 50)
- **Card Surface**: `#FFFFFF` (Pure White)
- **Surface Alt / Soft**: `#F1F5F9` (Slate 100)
- **Subtle Surface**: `#F8FAFC`
- **Border Default**: `#E2E8F0` (Slate 200)
- **Border Strong**: `#CBD5E1` (Slate 300)
- **Text Primary**: `#0F172A` (Slate 900)
- **Text Secondary**: `#475569` (Slate 600)
- **Text Muted**: `#64748B` (Slate 500)
- **Text Disabled**: `#94A3B8` (Slate 400)

### Semantic Status Colors

- **Success** (Approved, Healthy, Ready):
  - `#15803D` (Text/Icon), `#DCFCE7` (Border), `#F0FDF4` (Background)
- **Warning** (Uncertain, Degraded, Candidate):
  - `#B45309` (Text/Icon), `#FEF3C7` (Border), `#FFFBEB` (Background)
- **Danger** (Emergency, Blocked, Fault):
  - `#DC2626` (Text/Icon), `#FEE2E2` (Border), `#FEF2F2` (Background)

---

## 3. Typography & Spacing

- **Primary UI Font**: Modern clean sans-serif (`Inter`, system UI font stack).
- **Technical / Code Font**: Monospace (`JetBrains Mono`, system monospace) reserved strictly for event IDs, raw telemetry, and code blocks.
- **Corner Radius**: `rounded-xl` (12px) for cards, `rounded-full` for status and mode pills, `rounded-lg` (8px) for buttons.
- **Shadows**: Restrained elevation (`shadow-xs` or `shadow-sm`) over subtle borders.

---

## 4. Accessibility Standards

1. **High Contrast Ratios**: Minimum 4.5:1 contrast for normal text and 3:1 for large graphical components against neutral surfaces.
2. **Multi-Modal Status Indicators**: Status is **never** conveyed by color alone. Every badge pairs color with text labels and shape indicators (`●` Success, `▲` Warning, `■` Critical, `○` Neutral).
3. **Keyboard Focus**: Visible, accessible focus rings across all interactive buttons and inputs.

---

## 5. Prohibited Visual Anti-Patterns

- ❌ Near-black / dark-navy application canvas backgrounds (`#000000`, `#020617`).
- ❌ Neon glowing borders, pulse glows, and cyberpunk grids.
- ❌ Gaming HUD motifs and matrix code rain animations.
- ❌ Overly saturated red or green alarm backgrounds.
- ❌ Hardcoded color values scattered across component JSX.
