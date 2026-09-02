# NeuroMove Architecture: Device Identity & Capability Model (Phase 19)

## 1. Simulated Device Identity

The simulated endpoint exposes deterministic identification metadata:
- **`device_id`**: `"esp32_sim_01"`
- **`device_type`**: `"ESP32_SIMULATOR"`
- **`firmware_version`**: `"esp32-neuromove-v0.1.0"`
- **`protocol_version`**: `"1.0"`
- **`boot_id`**: Unique session nonce generated per cold reboot.

## 2. Advertised Capabilities

Embedded endpoints negotiate supported operations during the initial handshake:
- `COMMAND_RECEIVE`: Capability to accept structured command frames.
- `COMMAND_ACK`: Capability to return positive acknowledgements.
- `COMMAND_NACK`: Capability to return structured negative acknowledgements.
- `HEARTBEAT`: Capability to participate in round-trip ping/pong telemetry.
- `STATUS_REPORT`: Capability to provide diagnostic telemetry.
- `SAFE_STOP`: Capability to receive abstract software stop commands.
- `SIMULATION`: Explicit marker that the endpoint operates in pure software simulation.

## 3. Strict Non-Actuation Guarantee

In Phase 19, the simulated endpoint returns:
`reason: "SIMULATED_EXECUTED"`

This explicitly denotes that the command was validated and recorded by the software simulator. No physical motors, wheels, actuators, or GPIO pins are controlled.
