"""In-memory event dispatcher and stream broadcaster for NeuroMove."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ..domain.enums import EventType, OperatingMode
from .envelope import EventEnvelope, generate_event_id

logger = logging.getLogger("neuromove.events")

EventListener = Callable[[EventEnvelope[Any]], None]


class EventDispatcher:
    """Lightweight in-process event bus for local publishing and subscription."""

    def __init__(self) -> None:
        self._listeners: dict[EventType | str | None, list[EventListener]] = {}
        self._history: list[EventEnvelope[Any]] = []
        self._max_history: int = 1000
        self._sequence_counter: int = 0

    def next_sequence(self) -> int:
        """Increment and return the next monotonic sequence number."""
        self._sequence_counter += 1
        return self._sequence_counter

    def subscribe(
        self,
        listener_or_type: EventListener | EventType | str | None = None,
        listener: EventListener | None = None,
        *,
        event_type: EventType | str | None = None,
    ) -> None:
        """Register an event listener.

        Supports:
        - subscribe(listener, event_type=EventType.DECISION)
        - subscribe(listener)  (wildcard)
        - subscribe(EventType.DECISION, listener)
        - subscribe("*", listener)
        """
        cb: EventListener | None = None
        target_type: EventType | str | None = None

        if callable(listener_or_type):
            cb = listener_or_type
            target_type = event_type
        elif listener_or_type is not None and callable(listener):
            target_type = None if listener_or_type in ("*", None) else listener_or_type
            cb = listener
        elif callable(listener):
            cb = listener
            target_type = event_type

        if cb is None:
            raise ValueError("No callable listener provided to subscribe()")

        if target_type not in self._listeners:
            self._listeners[target_type] = []
        self._listeners[target_type].append(cb)

    def unsubscribe(self, listener: EventListener, event_type: EventType | None = None) -> None:
        """Unregister an existing event listener."""
        if event_type in self._listeners and listener in self._listeners[event_type]:
            self._listeners[event_type].remove(listener)
        if None in self._listeners and listener in self._listeners[None]:
            self._listeners[None].remove(listener)

    def publish(self, event: EventEnvelope[Any]) -> None:
        """Publish an event to all matched subscribers and buffer into ring memory."""
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        # Notify specific listeners
        if event.event_type in self._listeners:
            for cb in list(self._listeners[event.event_type]):
                try:
                    cb(event)
                except Exception as exc:
                    logger.error(
                        "Error in event listener for %s: %s",
                        event.event_type,
                        exc,
                        exc_info=True,
                    )

        # Notify wildcard listeners
        if None in self._listeners:
            for cb in list(self._listeners[None]):
                try:
                    cb(event)
                except Exception as exc:
                    logger.error(
                        "Error in wildcard event listener: %s",
                        exc,
                        exc_info=True,
                    )

    def dispatch(
        self,
        event_type: EventType,
        payload: Any,
        session_id: str | None = None,
        trial_id: str | None = None,
        user_id: str | None = "usr_sim_pilot01",
        mode: OperatingMode = OperatingMode.SIMULATION,
        source: str = "neuromove.simulation",
        timestamp: datetime | None = None,
    ) -> EventEnvelope[Any]:
        """Convenience method to construct, monotonic-sequence, publish, and return an EventEnvelope."""
        now_dt = timestamp or datetime.now(UTC)
        envelope = EventEnvelope[Any](
            event_id=generate_event_id(),
            schema_version="1.0.0",
            timestamp=now_dt,
            occurred_at=now_dt,
            processed_at=now_dt,
            mode=mode,
            event_type=event_type,
            session_id=session_id,
            trial_id=trial_id,
            user_id=user_id,
            source=source,
            sequence=self.next_sequence(),
            payload=payload,
        )
        self.publish(envelope)
        return envelope

    def get_recent_events(self, limit: int = 50) -> list[EventEnvelope[Any]]:
        """Retrieve recent buffered canonical events."""
        return self._history[-limit:]

    def clear(self) -> None:
        """Clear listeners, sequence counter, and history buffer."""
        self._listeners.clear()
        self._history.clear()
        self._sequence_counter = 0


# Global singleton event bus instance for local core
default_event_dispatcher = EventDispatcher()
default_dispatcher = default_event_dispatcher
