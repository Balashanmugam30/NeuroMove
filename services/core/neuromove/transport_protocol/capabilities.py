"""Device capabilities and command compatibility verification."""

from __future__ import annotations

from neuromove.transport_protocol.models import CommandType, DeviceCapability

# Mapping of commands to required device capabilities
COMMAND_REQUIRED_CAPABILITIES: dict[CommandType, DeviceCapability] = {
    CommandType.EXECUTE_INTENT: DeviceCapability.COMMAND_RECEIVE,
    CommandType.CANCEL_INTENT: DeviceCapability.COMMAND_RECEIVE,
    CommandType.STOP: DeviceCapability.SAFE_STOP,
    CommandType.HEARTBEAT: DeviceCapability.HEARTBEAT,
    CommandType.STATUS_REQUEST: DeviceCapability.STATUS_REPORT,
    CommandType.CAPABILITY_REQUEST: DeviceCapability.STATUS_REPORT,
    CommandType.PROTOCOL_NEGOTIATE: DeviceCapability.COMMAND_RECEIVE,
}


def is_command_supported(
    command_type: CommandType,
    capabilities: list[DeviceCapability],
) -> tuple[bool, str]:
    """Check if the given command type is supported by device capabilities."""
    required = COMMAND_REQUIRED_CAPABILITIES.get(command_type)
    if not required:
        return True, "No specific capability constraint"

    if required in capabilities:
        return True, f"Capability {required.value} satisfied"

    return False, f"Device lacks required capability: {required.value}"
