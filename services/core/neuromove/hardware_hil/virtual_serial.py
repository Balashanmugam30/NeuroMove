"""Deterministic Virtual Serial Channel and Duplex Pair for CI-safe HIL testing."""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)


class VirtualSerialChannel:
    """A single unidirectional buffered byte stream with timeout semantics."""

    def __init__(self, name: str = "vchan", timeout_s: float = 0.5) -> None:
        self.name = name
        self.timeout_s = timeout_s
        self._buffer = bytearray()
        self._lock = threading.Lock()
        self._is_open = True

    def write(self, data: bytes) -> int:
        """Write bytes to the virtual stream."""
        if not self._is_open:
            raise ConnectionError(f"VirtualSerialChannel '{self.name}' is closed.")
        with self._lock:
            self._buffer.extend(data)
            return len(data)

    def read(self, size: int = 1) -> bytes:
        """Read up to `size` bytes from the stream with timeout."""
        if not self._is_open:
            raise ConnectionError(f"VirtualSerialChannel '{self.name}' is closed.")

        start_time = time.monotonic()
        while time.monotonic() - start_time < self.timeout_s:
            with self._lock:
                if len(self._buffer) >= size:
                    chunk = bytes(self._buffer[:size])
                    del self._buffer[:size]
                    return chunk
                elif len(self._buffer) > 0 and size == 1:
                    chunk = bytes(self._buffer[:1])
                    del self._buffer[:1]
                    return chunk
            time.sleep(0.005)

        with self._lock:
            if len(self._buffer) > 0:
                available = min(len(self._buffer), size)
                chunk = bytes(self._buffer[:available])
                del self._buffer[:available]
                return chunk
        return b""

    def read_all(self) -> bytes:
        """Read all currently available bytes."""
        with self._lock:
            data = bytes(self._buffer)
            self._buffer.clear()
            return data

    @property
    def in_waiting(self) -> int:
        """Return number of bytes available to read."""
        with self._lock:
            return len(self._buffer)

    def flush(self) -> None:
        """Flush the buffer."""
        with self._lock:
            self._buffer.clear()

    def close(self) -> None:
        """Close the virtual channel."""
        self._is_open = False
        with self._lock:
            self._buffer.clear()


class VirtualSerialPair:
    """A full-duplex virtual serial connection pair (Host <-> Device)."""

    def __init__(self, port_name: str = "VIRTUAL_COM_01", timeout_s: float = 0.5) -> None:
        self.port_name = port_name
        self.host_to_device = VirtualSerialChannel(name=f"{port_name}_tx", timeout_s=timeout_s)
        self.device_to_host = VirtualSerialChannel(name=f"{port_name}_rx", timeout_s=timeout_s)
        self.is_open = True

    def close(self) -> None:
        """Close both directions of the virtual serial pair."""
        self.is_open = False
        self.host_to_device.close()
        self.device_to_host.close()
