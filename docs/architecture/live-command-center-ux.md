# Live Command Center — UX & Information Design

## 1. Visual Hierarchy & Token System

- **Foundation Canvas**: `#F8FAFC` (Slate-50)
- **Component Surfaces**: `#FFFFFF` (White with `#E2E8F0` structural borders)
- **Primary Brand Blue**: `#2563EB` (Actions, decoded directions, active steps)
- **Biomedical Teal Accent**: `#0D9488` (Electrophysiology, channel SNR, runtime FSM)
- **Semantic Status Tiers**:
  - `APPROVED` / `SAFE`: `#15803D` (Emerald-700) with `●` indicator
  - `BLOCKED` / `WARNING`: `#B45309` (Amber-700) with `▲` indicator
  - `STOP` / `EMERGENCY`: `#DC2626` (Red-600) with `■` indicator

---

## 2. Product Mode vs Research Mode

The Command Center dynamically tailors visual density using `useMode().uiIdentity`:
- **Product Mode**: Focused on operator clarity, high-level confidence meters, visual cues, and plain-language safety gate checklists.
- **Research Mode**: Exposes posterior probability vectors ($P(C|x)$), raw electrode SNR metrics, millisecond window dwell counters, and full canonical event envelope JSON payloads.

---

## 3. Responsive Layout Adaptability

- **Desktop (1280px+)**: 12-column grid layout with 3-column Level 1 and Level 2 telemetry cards, full 2D Digital Twin, and side-by-side Event Timeline.
- **Tablet (768px - 1024px)**: 2-column stacked grid with sticky header and responsive scrollable timeline.
- **Mobile (<768px)**: Priority vertical stack ensuring the E-STOP button and safety arbitration verdicts remain directly accessible above the fold.
