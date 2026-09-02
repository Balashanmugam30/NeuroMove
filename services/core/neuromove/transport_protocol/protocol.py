"""Canonical Protocol specifications, constants, and negotiation logic."""

from __future__ import annotations

PROTOCOL_VERSION: str = "1.0"
SUPPORTED_PROTOCOL_VERSIONS: set[str] = {"1.0"}

FRAME_START_DELIMITER: bytes = b"\xaa\x55"
FRAME_END_DELIMITER: bytes = b"\x55\xaa"

MAX_FRAME_PAYLOAD_BYTES: int = 1024
MAX_FRAME_TOTAL_BYTES: int = 2048

# Default timeouts and retry parameters
DEFAULT_ACK_TIMEOUT_SECONDS: float = 0.300  # 300ms
DEFAULT_HEARTBEAT_INTERVAL_SECONDS: float = 1.0  # 1s
DEFAULT_HEARTBEAT_TIMEOUT_SECONDS: float = 0.500  # 500ms
MAX_MISSED_HEARTBEATS_DEGRADED: int = 2
MAX_MISSED_HEARTBEATS_STALE: int = 3


def is_version_supported(version: str) -> bool:
    """Check if the provided protocol version string is supported."""
    return version in SUPPORTED_PROTOCOL_VERSIONS


def negotiate_protocol_version(client_version: str) -> tuple[bool, str, str]:
    """Negotiate protocol version.

    Returns:
        (is_compatible, negotiated_version, reason)
    """
    if not client_version or not isinstance(client_version, str):
        return False, "", "Malformed or empty protocol version string"

    parts = client_version.strip().split(".")
    if len(parts) < 2:
        return False, "", f"Invalid protocol version format: '{client_version}'"

    try:
        major = int(parts[0])
        minor = int(parts[1])
    except ValueError:
        return False, "", f"Non-numeric protocol version format: '{client_version}'"

    server_parts = PROTOCOL_VERSION.split(".")
    server_major = int(server_parts[0])
    server_minor = int(server_parts[1])

    if major != server_major:
        return (
            False,
            "",
            f"Incompatible major version: client requested {major}, server requires {server_major}",
        )

    # Minor version backward-compatible
    if minor <= server_minor:
        return True, client_version, f"Version {client_version} accepted"

    return True, PROTOCOL_VERSION, f"Downgraded client version to server version {PROTOCOL_VERSION}"
