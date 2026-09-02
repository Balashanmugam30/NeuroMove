"""Safe serial port discovery and configuration validation.

Provides port enumeration using pyserial when available, with deterministic
simulated/virtual fallback ports for virtual test harnesses and CI.
"""

from __future__ import annotations

import logging
from typing import Any

from neuromove.hardware_hil.models import SerialPortDescriptor

logger = logging.getLogger(__name__)


def discover_serial_ports() -> list[SerialPortDescriptor]:
    """Discover available communication ports without opening them.

    Enumerates real hardware COM/tty ports via pyserial if present, and provides
    standard simulated and virtual serial endpoints for HIL testing.
    """
    descriptors: list[SerialPortDescriptor] = []

    # Try pyserial enumeration
    try:
        import serial.tools.list_ports

        ports = serial.tools.list_ports.comports()
        for p in ports:
            hint = None
            desc_lower = (p.description or "").lower()
            if "esp32" in desc_lower or "cp210" in desc_lower or "ch340" in desc_lower or "ftdi" in desc_lower:
                hint = "ESP32_COMPATIBLE"
            elif "virtual" in desc_lower:
                hint = "VIRTUAL_SERIAL"

            descriptors.append(
                SerialPortDescriptor(
                    port=p.device,
                    description=p.description or p.device,
                    manufacturer=p.manufacturer,
                    serial_number=p.serial_number,
                    vid=hex(p.vid) if p.vid is not None else None,
                    pid=hex(p.pid) if p.pid is not None else None,
                    device_hint=hint,
                    is_open=False,
                    baud_rate=115200,
                )
            )
    except Exception as exc:
        logger.debug("pyserial enumeration skipped/unavailable: %s", exc)

    # Always ensure virtual and simulated endpoints are available for non-hardware environments
    virtual_ports = [
        SerialPortDescriptor(
            port="VIRTUAL_COM_01",
            description="NeuroMove Virtual Serial Port 1 (In-Memory Duplex)",
            manufacturer="NeuroMove Laboratory",
            serial_number="VIRT-ESP32-001",
            vid="0x303A",
            pid="0x1001",
            device_hint="VIRTUAL_SERIAL",
            is_open=False,
            baud_rate=115200,
        ),
        SerialPortDescriptor(
            port="SIMULATED_ENDPOINT",
            description="NeuroMove In-Memory ESP32 Simulator",
            manufacturer="NeuroMove Core",
            serial_number="SIM-ESP32-001",
            vid="0x303A",
            pid="0x0002",
            device_hint="ESP32_SIMULATOR",
            is_open=False,
            baud_rate=115200,
        ),
    ]

    # Combine ensuring unique ports
    existing_ports = {d.port for d in descriptors}
    for vp in virtual_ports:
        if vp.port not in existing_ports:
            descriptors.append(vp)

    return descriptors


def validate_port_settings(
    port: str,
    baud_rate: int = 115200,
    read_timeout_ms: int = 500,
    write_timeout_ms: int = 500,
) -> dict[str, Any]:
    """Validate serial configuration parameters.

    Ensures baud rate and timeouts meet safety specifications.
    """
    valid_baud_rates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
    if baud_rate not in valid_baud_rates:
        raise ValueError(
            f"Invalid baud rate {baud_rate}. Must be one of {valid_baud_rates}."
        )

    if read_timeout_ms < 50 or read_timeout_ms > 10000:
        raise ValueError("read_timeout_ms must be between 50ms and 10000ms.")

    if write_timeout_ms < 50 or write_timeout_ms > 10000:
        raise ValueError("write_timeout_ms must be between 50ms and 10000ms.")

    return {
        "port": port,
        "baud_rate": baud_rate,
        "read_timeout_ms": read_timeout_ms,
        "write_timeout_ms": write_timeout_ms,
    }
