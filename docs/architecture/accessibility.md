# NeuroMove Accessibility & Responsiveness Architecture

## 1. Compliance Standard
NeuroMove targets WCAG 2.1 AA accessibility guidelines across all operational and scientific screens.

---

## 2. Accessibility Invariants

### 1. Multi-Channel Signal Rule
Status must never rely on color hue alone. Every badge, indicator, and warning combines:
- A distinct unicode shape or SVG icon (`●`, `▲`, `■`, `○`)
- A clear text label (`SAFE`, `WARNING`, `EMERGENCY`)
- High-contrast background and border styling

### 2. Contrast Ratios
- Primary text on canvas (`#0F172A` on `#F8FAFC`): **16.5:1** (Exceeds 4.5:1 requirement)
- Brand action blue on white (`#2563EB` on `#FFFFFF`): **4.6:1**
- Secondary text (`#475569` on `#F8FAFC`): **7.8:1**

### 3. Keyboard Navigation
- All interactive controls (`Button`, `Select`, `Input`, `SegmentedControl`, `Switch`) are accessible via standard `Tab`, `Shift+Tab`, `Space`, and `Enter` key sequences.
- Visible focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500`) are applied universally without interfering with pointer users.

### 4. Reduced Motion Support
- Media query `@media (prefers-reduced-motion: reduce)` disables decorative transitions and animations while preserving immediate functional state changes.

---

## 3. Responsive Breakpoints
- **Desktop (1024px+)**: Primary operator control station with full persistent sidebar, dual-column telemetry grids, and 60 FPS oscilloscope.
- **Tablet (768px - 1023px)**: Collapsible sidebar, stacked telemetry panels, and full-width digital twin.
- **Mobile (< 768px)**: Sliding drawer navigation, stacked metric cards, sticky TopBar with accessible E-STOP.
