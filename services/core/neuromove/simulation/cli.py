"""NeuroMove Simulation CLI Runner.

Provides headless execution and verification of deterministic scenarios.
"""

from __future__ import annotations

import argparse

from neuromove.simulation.runner import SimulationEngine
from neuromove.simulation.scenarios import SCENARIOS


def main() -> None:
    parser = argparse.ArgumentParser(description="NeuroMove Deterministic Simulation CLI")
    parser.add_argument(
        "--scenario",
        "-s",
        default="right-turn",
        choices=list(SCENARIOS.keys()),
        help="Scenario ID to execute",
    )
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed")
    parser.add_argument(
        "--step-dt", type=float, default=0.1, help="Simulation step delta (seconds)"
    )

    args = parser.parse_args()

    engine = SimulationEngine()
    print("==================================================")
    print("NeuroMove Deterministic Simulation Runner")
    print(f"Scenario: {args.scenario}")
    print(f"Seed:     {args.seed}")
    print("Mode:     SIMULATION")
    print("==================================================")

    events = engine.run_scenario_sync(args.scenario, seed=args.seed, step_dt=args.step_dt)

    print("\nExecution Complete:")
    print(f"Total Emitted Events: {len(events)}")
    print(f"First Event Sequence: {events[0].sequence if events else 'N/A'}")
    print(f"Last Event Sequence:  {events[-1].sequence if events else 'N/A'}")
    print("\nSample Event Log:")
    for evt in events[:5]:
        print(f"  [Seq {evt.sequence:03d}] {evt.event_type.value:<22} ({evt.occurred_at})")
    if len(events) > 5:
        print(f"  ... ({len(events) - 5} intermediate events)")
        last = events[-1]
        print(f"  [Seq {last.sequence:03d}] {last.event_type.value:<22} ({last.occurred_at})")
    print("==================================================")


if __name__ == "__main__":
    main()
