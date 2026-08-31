# NeuroMove Engineering & Development Principles

## 1. Safety-First Architecture (Fail-Closed)

- The system initializes in a safe default state: `IDLE`.
- No actuation command can be issued unless the state machine is in `EXECUTING`, the safety arbitrator has returned `APPROVED`, and signal quality is strictly above threshold.
- An emergency stop interrupts from any state and forces an immediate zero-velocity fail-safe.

## 2. Scientific Honesty & Boundary Clarity

- NeuroMove decodes trained sensorimotor rhythm modulation ($\mu$ and $\beta$ bands) using Common Spatial Patterns.
- It **never** claims natural-language thought reading, diagnostic clinical certification, or universal accuracy.
- Simulated or synthetic telemetry is always explicitly flagged with `OperatingMode.SIMULATION`.

## 3. Single Canonical Data & Event Model

- All telemetry, state changes, robot commands, and database logs use the same typed Canonical Event Envelope.
- Parity between Python (`Pydantic`) and TypeScript (`Zod`) contracts prevents schema drift.

## 4. Reproducible Research & Replay

- Every trial and calibration run is tagged with session and subject metadata.
- Recorded sessions can be deterministically replayed through the identical DSP and classifier pipelines.
