# NeuroMove Contract & Schema Versioning Strategy

## 1. Versioning Principles

NeuroMove separates versioning across three distinct layers to ensure backwards compatibility across recorded research datasets, local FastAPI APIs, and web clients:

```
┌─────────────────────────────────────────────────────────┐
│ Application Version (e.g. 0.1.0)                        │
│   - Platform release bundle                             │
├─────────────────────────────────────────────────────────┤
│ API Version (e.g. /api/v1/)                             │
│   - HTTP / WebSocket transport interface                │
├─────────────────────────────────────────────────────────┤
│ Event & Contract Schema Version (e.g. 1.0.0)            │
│   - Serialization contract for recorded data and events │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Universal Schema Versioning

Every canonical event envelope and domain model serialization carries an explicit `schema_version`:

- `1.0.0`: Initial baseline canonical schema established in Phase 02.
- **Breaking Changes** (Major bump `2.0.0`): Adding required fields, changing type definitions, or altering event payload semantics.
- **Non-Breaking Additions** (Minor bump `1.1.0`): Adding optional or default-backed fields.
- **Patches** (Patch bump `1.0.1`): Clarifying descriptions or documentation.

---

## 3. Cross-Language Parity

Contracts are authored symmetrically:

- **Python Backend**: Pydantic v2 models in `services/core/neuromove/domain` and `events`.
- **TypeScript Frontend**: Zod schemas and TypeScript types in `@neuromove/contracts`.

Continuous validation tests (`test_fixtures.py` and `fixtures.test.ts`) verify that shared JSON fixtures parse identically in both runtimes.
