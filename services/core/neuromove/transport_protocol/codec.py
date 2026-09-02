"""Canonical deterministic serialization and deserialization for Command Envelopes."""

from __future__ import annotations

import json
from typing import Any

from neuromove.transport_protocol.models import CommandEnvelope


def serialize_canonical_dict(payload: dict[str, Any]) -> str:
    """Serialize dictionary canonically with sorted keys, compact separators."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def encode_command(envelope: CommandEnvelope) -> bytes:
    """Encode CommandEnvelope into canonical deterministic JSON bytes."""
    envelope_dict = envelope.model_dump(mode="json")
    canonical_json = serialize_canonical_dict(envelope_dict)
    return canonical_json.encode("utf-8")


def decode_command(data: bytes | str) -> CommandEnvelope:
    """Decode raw bytes or string into validated CommandEnvelope."""
    if isinstance(data, bytes):
        text = data.decode("utf-8")
    else:
        text = data
    parsed = json.loads(text)
    return CommandEnvelope.model_validate(parsed)
