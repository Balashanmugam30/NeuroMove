"""In-memory event dispatcher and stream broadcaster for NeuroMove."""

import logging
from collections.abc import Callable
from typing import Any

from ..domain.enums import EventType
from .envelope import EventEnvelope

logger = logging.getLogger("neuromove.events")

EventListener = Callable[[EventEnvelope[Any]], None]


class EventDispatcher:
    """Lightweight in-process event bus for local publishing and subscription."""

    def __init__(self) -> None:
        self._listeners: dict[EventType | None, list[EventListener]] = {}
        self._history: list[EventEnvelope[Any]] = []
        self._max_history: int = 1000

    def subscribe(self, listener: EventListener, event_type: EventType | None = None) -> None:
        """Register an event listener for a specific event type or all events."""
        if event_type not in self._listeners:
            self._listeners[event_type] = []
        self._listeners[event_type].append(listener)

    def unsubscribe(self, listener: EventListener, event_type: EventType | None = None) -> None:
        """Unregister an existing event listener."""
        if event_type in self._listeners and listener in self._listeners[event_type]:
            self._listeners[event_type].remove(listener)

    def publish(self, event: EventEnvelope[Any]) -> None:
        """Publish an event to all matched subscribers and buffer into ring memory."""
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        # Notify specific listeners
        if event.event_type in self._listeners:
            for listener in self._listeners[event.event_type]:
                try:
                    listener(event)
                except Exception as exc:
                    logger.error(
                        "Error in event listener for %s: %s",
                        event.event_type,
                        exc,
                        exc_info=True,
                    )

        # Notify wildcard listeners
        if None in self._listeners:
            for listener in self._listeners[None]:
                try:
                    listener(event)
                except Exception as exc:
                    logger.error(
                        "Error in wildcard event listener: %s",
                        exc,
                        exc_info=True,
                    )

    def get_recent_events(self, limit: int = 50) -> list[EventEnvelope[Any]]:
        """Retrieve recent buffered canonical events."""
        return self._history[-limit:]

    def clear(self) -> None:
        """Clear listeners and history buffer."""
        self._listeners.clear()
        self._history.clear()


# Global singleton event bus instance for local core
default_event_dispatcher = EventDispatcher()
