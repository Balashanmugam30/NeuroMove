"""Tests for Canonical Event Envelope and Dispatcher."""

from neuromove.domain.enums import (
    EventType,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
)
from neuromove.events.dispatcher import EventDispatcher
from neuromove.events.envelope import (
    DecisionPayload,
    EventEnvelope,
    generate_correlation_id,
    generate_event_id,
)


def test_event_id_and_correlation_generation() -> None:
    evt_id = generate_event_id()
    assert evt_id.startswith("evt_")

    corr_id = generate_correlation_id()
    assert corr_id.startswith("corr_")


def test_canonical_event_envelope_creation() -> None:
    decision_payload = DecisionPayload(
        intent=Intent.RIGHT,
        confidence=0.92,
        signal_quality=0.91,
        risk=RiskLevel.SAFE,
        decision=SafetyDecision.APPROVED,
        runtime_state=RuntimeState.CONFIRMED,
        rationale="Clear motor-imagery mu desynchronization",
    )

    event = EventEnvelope[DecisionPayload](
        session_id="S001",
        user_id="U001",
        mode=OperatingMode.SIMULATION,
        event_type=EventType.DECISION,
        payload=decision_payload,
    )

    assert event.event_id.startswith("evt_")
    assert event.version == "1.0.0"
    assert event.session_id == "S001"
    assert event.mode == OperatingMode.SIMULATION
    assert event.event_type == EventType.DECISION
    assert event.payload.intent == Intent.RIGHT
    assert event.payload.confidence == 0.92
    assert event.payload.decision == SafetyDecision.APPROVED


def test_event_dispatcher_subscription_and_publishing() -> None:
    dispatcher = EventDispatcher()
    received_events = []

    def on_decision(evt: EventEnvelope) -> None:
        received_events.append(evt)

    dispatcher.subscribe(on_decision, event_type=EventType.DECISION)

    event = EventEnvelope[DecisionPayload](
        event_type=EventType.DECISION,
        payload=DecisionPayload(intent=Intent.LEFT, confidence=0.88),
    )
    dispatcher.publish(event)

    assert len(received_events) == 1
    assert received_events[0].payload.intent == Intent.LEFT

    # Check recent history
    recent = dispatcher.get_recent_events(10)
    assert len(recent) == 1
