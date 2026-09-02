# NeuroMove — Full-System UI/UX Baseline Audit (Phase 24.2 Baseline)

## 1. Executive Summary & Audit Scope

This document establishes the initial baseline inventory of all 27 routes and component families across the NeuroMove frontend prior to the Phase 24.2 bright theme normalization and UX hardening.

**Target Product Aesthetic**:
- Canvas: `#F8FAFC` (Slate-50)
- Surface: `#FFFFFF` (White)
- Primary Action: `#2563EB` (Blue-600)
- Biomedical Accent: `#0D9488` (Teal-600)
- Primary Text: `#0F172A` (Slate-900)
- Secondary Text: `#475569` (Slate-600)
- Border: `#E2E8F0` (Slate-200)

---

## 2. Complete Route Inventory Matrix (Baseline)

| # | Route | Product Area | Baseline Theme | Layout / Rhythm | Typography | Responsive | Accessibility | Console / Hydration | Baseline Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/` | Root Landing | Bright | Structured | Clean | Good | Good | Clean | Pass |
| 2 | `/overview` | Executive Overview | Bright | Grid / Hero | Unified | Reflows Clean | Good | Clean | Pass |
| 3 | `/demo` | Guided Demonstration | Bright | Step Timeline | Unified | Reflows Clean | Good | Clean | Pass |
| 4 | `/live` | Live Control Station | Bright / Dark Canvas | Split Grid | Mixed mono | Needs Mobile Audit | Lacks aria labels | Clean | Needs Polish (P2) |
| 5 | `/robot` | Robot Mobility | Bright | 2-Col Card | Clean | Good | Good | Clean | Pass |
| 6 | `/eeg` | EEG Lab & Signals | Bright / Dark Canvas | Tabbed | Mixed sizes | Good | Tab index ok | Clean | Pass |
| 7 | `/eeg/live` | Live EEG Stream | Bright / Dark Canvas | 3-Panel Grid | Mono / sans | Good | Good | Clean | Pass |
| 8 | `/eeg/preprocessing` | Preprocessing & DSP | Bright / Mixed dark: | Tabbed | Mixed font | Card spacing | Table headers | Clean | Inconsistent (P1) |
| 9 | `/eeg/features` | Epochs & Features | Mixed dark: classes | Tabbed / Grid | Inconsistent | Table overflow | Low contrast | Clean | Inconsistent (P1) |
| 10 | `/calibration` | Baseline Calibration | Bright | Wizard / Stepper | Unified | Good | Stepper aria | Clean | Pass |
| 11 | `/models` | CSP & Models | Bright | Card list | Clean | Good | Good | Clean | Pass |
| 12 | `/models/classical` | Classical Models | Bright | Metric Grid | Clean | Good | Good | Clean | Pass |
| 13 | `/models/lab` | AI Model Laboratory | Bright | Tabbed Grid | Unified | Good | Modal focus | Clean | Pass |
| 14 | `/adaptation` | Adaptive Updates | Bright / Modal dark: | Graph / Table | Clean | Modal scroll | Good | Clean | Pass |
| 15 | `/confidence` | Confidence Engine | Bright / Code dark | 2-Col Split | Unified | Good | Good | Clean | Pass |
| 16 | `/intent` | Intent State Machine | Bright / Code dark | FSM / Sim | Unified | Good | Good | Clean | Pass |
| 17 | `/safety` | Safety Arbitration | Bright | 12 Invariants | Clean | Good | High contrast | Clean | Pass |
| 18 | `/resilience` | Resilience Lab | Bright / Mixed dark: | Split Grid | Mixed mono | Table scroll | Good | Clean | Inconsistent (P2) |
| 19 | `/transport` | Command Transport | Bright | Console Grid | Mono / sans | Frame viewer | Good | Clean | Pass |
| 20 | `/hardware` | Hardware HIL Lab | Mixed dark: classes | Multi-card | Inconsistent | Header badges | Low contrast | Clean | Inconsistent (P1) |
| 21 | `/sensors` | Multimodal Sensors | Bright | Matrix Grid | Unified | Reflows Clean | High contrast | Clean | Pass |
| 22 | `/research` | Research Lab & Replay | **Dark (bg-slate-900)** | Dense Dark Grid | White on dark | Dark input boxes | Low contrast | Clean | **Critical Fix (P0)** |
| 23 | `/research/datasets` | Public Datasets | Bright | Card / Modal | Clean | Table scroll | Modal aria | Clean | Pass |
| 24 | `/sessions` | Session History | Bright | Table Grid | Clean | Table scroll | Good | Clean | Pass |
| 25 | `/results` | Evidence & Analytics | Bright | Metric cards | Clean | Good | Good | Clean | Pass |
| 26 | `/docs` | Documentation | Bright | Markdown Doc | Clean | Good | Good | Clean | Pass |
| 27 | `/system` | System Diagnostics | Bright | Service Matrix | Clean | Good | Good | Clean | Pass |

---

## 3. Dark Theme Findings & Categorization

### Category A: Accidental / Legacy Dark Pages (P0 - Must Be Converted to Bright Theme)
1. **`apps/web/app/research/page.tsx`**:
   - Header ribbon: `bg-slate-900 border-slate-800`
   - Input controls: `bg-slate-950 border-slate-700 text-white`
   - Section wrappers: dark containers
2. **`apps/web/components/research/*`**:
   - `AblationSweepWorkspace.tsx`: `bg-slate-900 border-slate-800 text-white`
   - `ArtifactExportHub.tsx`: `bg-slate-900 border-slate-800`
   - `GoldenScenariosRunner.tsx`: `bg-slate-900 border-slate-800`
   - `LatencyPercentileChart.tsx`: `bg-slate-900 border-slate-800`
   - `ManifestInspector.tsx`: `bg-slate-900 border-slate-800`
   - `ReplayStageTimeline.tsx`: `bg-slate-900 border-slate-800`
   - `ReproducibilityAuditPanel.tsx`: `bg-slate-900 border-slate-800`
   - `RobustnessStressTest.tsx`: `bg-slate-900 border-slate-800`
   - `ScientificMetricsPanel.tsx`: `bg-slate-900 border-slate-800`

### Category B: Inconsistent `dark:*` Pseudo-Classes (P1 - Remove & Normalize to Bright Tokens)
- `apps/web/components/features/ClassDistributionCard.tsx` (`dark:bg-slate-900`)
- `apps/web/components/features/CovarianceViewer.tsx` (`dark:bg-slate-900`, `dark:text-slate-100`)
- `apps/web/components/features/EpochSegmentor.tsx` (`dark:bg-slate-900`)
- `apps/web/components/features/EpochVisualizer.tsx` (`dark:bg-slate-900`)
- `apps/web/components/features/FeatureTable.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/CommandVerificationConsole.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/ConnectionNegotiationPanel.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/DeviceOverviewCard.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/HILExperimentLab.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/HardwareTraceViewer.tsx` (`dark:bg-slate-900`)
- `apps/web/components/hardware/RecoveryDiagnosticsPanel.tsx` (`dark:bg-slate-900`)
- `apps/web/app/hardware/page.tsx` (`dark:border-slate-800`)
- `apps/web/app/eeg/features/page.tsx` (`dark:text-slate-100`)

### Category C: Justified Technical Exceptions (Documented & Preserved)
- **Signal & Oscilloscope Canvases**:
  - `components/eeg/EEGOscilloscope.tsx`: High-contrast black/slate canvas for multi-channel microvolt waveform drawing.
  - `components/eeg-live/LiveSignalWaveformPanel.tsx`: High-contrast waveform oscilloscope.
  - `components/preprocessing/SignalComparisonPanel.tsx`: Filtered vs Raw signal comparison trace plots.
  - **Invariant**: The enclosing cards, headers, metadata labels, controls, and surrounding borders must remain crisp white/bright theme (`bg-white border-slate-200 text-slate-900`).

---

## 4. UI/UX Defect Severity & Action Plan

| Issue ID | Route / Component | Severity | Category | Problem Description | Proposed Normalization Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | `/research` & `components/research/*` | **P0** | THEME | Entire Research Lab workspace renders in legacy dark slate styling (`bg-slate-900`), clashing with the bright product design system. | Convert all 9 research components and page to `bg-white border-slate-200 text-slate-900 bg-slate-50`. |
| **ISSUE-02** | `components/features/*` | **P1** | THEME | Lingering `dark:*` prefixes cause uneven border and background styling. | Remove `dark:*` classes, standardize to Slate-200 borders and White cards. |
| **ISSUE-03** | `components/hardware/*` | **P1** | THEME | Hardware HIL components use dark mode card wrappers. | Normalize to standard white surface and slate borders with sky/indigo semantic accents. |
| **ISSUE-04** | `/eeg/features` | **P1** | SPACING / TABLE | Feature table and epoch visualizer lack horizontal scroll containment on small screens. | Add `overflow-x-auto` to table wrappers and ensure responsive reflow. |
| **ISSUE-05** | `components/layout/Sidebar.tsx` | **P2** | NAVIGATION | Sidebar navigation items need clean spacing and active state contrast. | Verified clean in Phase 24.1; ensure mobile drawer backdrop is styled consistently. |
| **ISSUE-06** | All Major Routes | **P2** | RESPONSIVE | Ensure `scrollWidth <= viewportWidth` on 390x844 mobile viewport across all 27 pages. | Audit in Playwright across all 5 standard viewports. |
| **ISSUE-07** | Copy & Safety Disclosures | **P2** | COPY | Confirm all routes explicitly declare `SIMULATOR`, `RECORDED`, or `PHYSICAL` and non-actuating HIL boundary. | Standardize badges and headers across all pages. |
