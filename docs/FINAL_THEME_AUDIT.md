# NeuroMove — Canonical Bright Theme Design Token & UI Unification Specification (Phase 24.2)
**Standard**: BRIGHT • HEALTH-TECH • SCIENTIFIC • ENGINEERING-GRADE  
**Author**: NeuroMove Core Engineering Team  
**Status**: ACTIVE STANDARD

---

## 1. Design Token Palette & Color Hierarchy

The NeuroMove application adheres strictly to the canonical Bright Theme token matrix:

### Core Tokens
| Token | Tailwind Class | Hex Value | Application |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `bg-slate-50` | `#F8FAFC` | App-wide root background and page layout base |
| **Surface (Card/Panel)** | `bg-white` | `#FFFFFF` | Primary card containers, modals, sheets, and drawers |
| **Subsurface / Inset** | `bg-slate-50` / `bg-slate-100` | `#F1F5F9` | Inner parameter groups, code insets, table header cells |
| **Primary Action** | `bg-blue-600` / `hover:bg-blue-700` | `#2563EB` | Primary buttons, active tab indicators, focus rings |
| **Biomedical Accent** | `bg-teal-600` / `text-teal-700` | `#0D9488` | Sensor telemetry, EEG features, signal processing highlights |
| **Primary Text** | `text-slate-900` | `#0F172A` | Page headers, card titles, key metric numbers |
| **Secondary Text** | `text-slate-600` / `text-slate-500` | `#475569` | Subtitles, descriptions, secondary metadata, table units |
| **Border / Divider** | `border-slate-200` | `#E2E8F0` | Card borders, table row dividers, header rules |
| **Muted Border** | `border-slate-100` | `#F1F5F9` | Subtle sub-card dividers and internal borders |

### Semantic Status Tokens
| Semantic Role | Background | Text | Border | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success / Valid** | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | Connected state, Authorized gate, Passed test |
| **Warning / Skew** | `bg-amber-50` | `text-amber-700` | `border-amber-200` | Drift warning, Negotiating state, Non-actuation banner |
| **Degraded / Stale** | `bg-orange-50` | `text-orange-700` | `border-orange-200` | Degraded packet rate, Missed heartbeat pings |
| **Error / Denied** | `bg-rose-50` | `text-rose-700` | `border-rose-200` | Denied safety gate, CRC error, Disconnected device |
| **Information** | `bg-blue-50` | `text-blue-700` | `border-blue-200` | Informational badges, Phase pills, Model versions |
| **Specialized Lab** | `bg-purple-50` | `text-purple-700` | `border-purple-200` | HIL verification matrix, Lineage links |

---

## 2. Component Design Standards

### Card Containers
All major content containers use consistent border radii, padding, borders, and subtle elevation:
```tsx
className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans"
```

### Table Structures
All tabular data employs responsive container wrappers, sticky or distinct headers, and alternating/hover states:
```tsx
<div className="overflow-x-auto border border-slate-200 rounded-lg">
  <table className="w-full text-left text-xs font-mono">
    <thead>
      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 text-2xs uppercase">
        <th className="p-2.5">Header Column</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 text-2xs">
      <tr className="hover:bg-slate-50/70">
        <td className="p-2.5 font-semibold text-slate-800">Value</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Form Controls
Form inputs, selects, and textareas use clean bright surfaces with distinct focus rings:
```tsx
className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
```

### Buttons
- **Primary Button**: `bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-4 py-2 text-xs shadow-2xs transition`
- **Secondary / Outline Button**: `bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg px-3 py-2 text-xs shadow-2xs transition`
- **Destructive Button**: `bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg px-3 py-2 text-xs shadow-2xs transition`

---

## 3. Scientific & Oscilloscope Exceptions

To maintain visual contrast for multi-channel biomedical signal waveforms:
1. The canvas plot interiors in `EEGOscilloscope.tsx`, `LiveSignalWaveformPanel.tsx`, `SignalComparisonPanel.tsx`, `EpochVisualizer.tsx`, and `MultimodalSignalOscilloscope.tsx` retain a high-contrast dark interior (`#020617`).
2. The enclosing card, channel legends, filter selectors, metric cards, status indicators, and headers remain 100% Bright Theme.
