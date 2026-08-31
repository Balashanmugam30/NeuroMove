# NeuroMove Component Guidelines

## 1. Reusable Component Inventory

| Component | Role & Usage | Location |
| :--- | :--- | :--- |
| `PageHeader` | Standardized header container for all routes. | `components/ui/PageHeader.tsx` |
| `Button` | Variants: `primary`, `secondary`, `outline`, `ghost`, `destructive`. | `components/ui/Button.tsx` |
| `FormControls` | Accessible form primitives: `Input`, `Select`, `Switch`, `SegmentedControl`. | `components/ui/FormControls.tsx` |
| `MetricCard` | Telemetry KPI card with unit, subtitle, timestamp, and source tag. | `components/ui/MetricCard.tsx` |
| `SectionCard` | Standard white surface container with title, description, and actions. | `components/ui/SectionCard.tsx` |
| `DecisionExplanation`| Structured safety gate checklist (intent, signal, clearance, estop). | `components/ui/DecisionExplanation.tsx` |
| `FreshnessIndicator` | Real-time age badge (`FRESH`, `STALE`, `DISCONNECTED`). | `components/ui/FreshnessIndicator.tsx` |
| `Notice` | Status banner strip (`info`, `warning`, `danger`, `success`, `degraded`). | `components/ui/Notice.tsx` |
| `InsightCard` | Technical & scientific callout card with brand/accent tinting. | `components/ui/InsightCard.tsx` |
| `DataTable` | Accessible tabular display with loading skeletons and empty states. | `components/ui/DataTable.tsx` |
| `StatusBadge` | Multi-channel semantic pill combining icon, shape, and text. | `components/ui/StatusBadge.tsx` |
| `ModeBadge` | Operating mode indicator (`LIVE`, `REPLAY`, `SIMULATION`). | `components/ui/ModeBadge.tsx` |
| `RealtimeStatusBadge`| Transport health and round-trip latency indicator. | `components/ui/RealtimeStatusBadge.tsx` |
| `EventTimeline` | Chronological canonical event stream with filtering. | `components/ui/EventTimeline.tsx` |
| `EmptyState` / `ErrorState` / `LoadingState` | Standard lifecycle feedback states. | `components/ui/` |

---

## 2. Bounded Memory Rule
Components consuming streaming real-time events must never allow state arrays to grow unbounded. Use:
- `EEGRingBuffer` for continuous electrophysiological waveform series.
- Capped array slicing (e.g., `prev.slice(0, 49)`) for timeline events.
- Latest-value caching for robot state and safety telemetry.
