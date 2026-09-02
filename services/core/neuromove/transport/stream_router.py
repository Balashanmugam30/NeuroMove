"""NeuroMove Real-Time Stream Router & Event Broker.

Connects the canonical domain event bus to typed WebSocket streaming pathways
with channel multiplexing and latest-value caching.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from neuromove.events.dispatcher import default_dispatcher
from neuromove.events.envelope import EventEnvelope
from neuromove.simulation.eeg_generator import EEGChunk
from neuromove.simulation.runner import simulation_engine
from neuromove.transport.connection_registry import connection_registry
from neuromove.transport.latest_value_cache import latest_value_cache
from neuromove.transport.models import TransportMessage, TransportMessageType, TransportStream

logger = logging.getLogger("neuromove.transport.router")


class StreamRouter:
    """Routes events and synthetic electrophysiology data to typed stream subscribers."""

    def __init__(self) -> None:
        # Subscribe to canonical event dispatcher
        default_dispatcher.subscribe("*", self.handle_canonical_event)
        # Register chunk callback from simulation engine
        simulation_engine.register_chunk_listener(self.handle_eeg_chunk)

    def handle_canonical_event(self, envelope: EventEnvelope[Any]) -> None:
        """Process an incoming canonical event from the dispatcher, update cache,

        and broadcast to appropriate stream subscribers.
        """
        # 1. Update state snapshot cache
        latest_value_cache.update_from_event(envelope)

        # 2. Determine target stream channels
        evt_type_val = envelope.event_type.value

        # Always broadcast to 'live' stream
        live_msg = TransportMessage(
            type=TransportMessageType.EVENT,
            stream=TransportStream.LIVE.value,
            timestamp=datetime.now(UTC),
            event=envelope,
        )
        connection_registry.broadcast(live_msg)

        # Route robot-specific events to 'robot' stream
        if "ROBOT" in evt_type_val:
            robot_msg = TransportMessage(
                type=TransportMessageType.EVENT,
                stream=TransportStream.ROBOT.value,
                timestamp=datetime.now(UTC),
                event=envelope,
            )
            connection_registry.broadcast(robot_msg)

        # Route safety-specific events to 'safety' stream
        if "SAFETY" in evt_type_val or "EMERGENCY" in evt_type_val or "FAULT" in evt_type_val:
            safety_msg = TransportMessage(
                type=TransportMessageType.EVENT,
                stream=TransportStream.SAFETY.value,
                timestamp=datetime.now(UTC),
                event=envelope,
            )
            connection_registry.broadcast(safety_msg)

        # Route confidence & temporal events to 'confidence' stream
        if "CONFIDENCE" in evt_type_val or "TEMPORAL" in evt_type_val:
            confidence_msg = TransportMessage(
                type=TransportMessageType.EVENT,
                stream=TransportStream.CONFIDENCE.value,
                timestamp=datetime.now(UTC),
                event=envelope,
            )
            connection_registry.broadcast(confidence_msg)

        # Route intent lifecycle events to 'intent' stream
        if "INTENT" in evt_type_val:
            intent_msg = TransportMessage(
                type=TransportMessageType.EVENT,
                stream=TransportStream.INTENT.value,
                timestamp=datetime.now(UTC),
                event=envelope,
            )
            connection_registry.broadcast(intent_msg)

    def handle_eeg_chunk(self, chunk: EEGChunk) -> None:
        """Route high-frequency EEG time-series batches to 'eeg' stream subscribers."""
        chunk_dict = chunk.model_dump(mode="json")
        eeg_msg = TransportMessage(
            type=TransportMessageType.EVENT,
            stream=TransportStream.EEG.value,
            timestamp=datetime.now(UTC),
            payload=chunk_dict,
        )
        connection_registry.broadcast(eeg_msg)


# Global singleton instance
stream_router = StreamRouter()
