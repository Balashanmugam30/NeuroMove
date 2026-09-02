# ESP32 Transport Adapters & Hardware Abstraction Boundary

## 1. Abstract Adapter Interface

The `TransportAdapter` abstract base class decouples the core protocol service from the underlying physical, virtual, or simulated byte transmission channel:

```python
class TransportAdapter(abc.ABC):
    @abc.abstractmethod
    def connect(self) -> bool: ...

    @abc.abstractmethod
    def disconnect(self) -> None: ...

    @abc.abstractmethod
    def negotiate(self, client_version: str, session_id: str) -> tuple[bool, str, str]: ...

    @abc.abstractmethod
    def send_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack: ...

    @abc.abstractmethod
    def ping(self) -> float: ...

    @abc.abstractmethod
    def health(self) -> TransportConnectionState: ...

    @abc.abstractmethod
    def capabilities(self) -> list[DeviceCapability]: ...

    @abc.abstractmethod
    def identity(self) -> DeviceIdentity: ...

    @abc.abstractmethod
    def close(self) -> None: ...
```

---

## 2. Adapter Implementations

### A. `SimulatedEsp32Adapter`
- Pure in-memory software adapter delegating to `Esp32Simulator`.
- Zero OS overhead; executes instantaneously (< 1ms).

### B. `VirtualSerialAdapter`
- In-memory duplex byte channel (`VirtualSerialPair`) delegating to `Esp32ProtocolEmulator`.
- Emulates UART chunking, read/write timeouts, partial frame streaming, and disconnections for robust CI verification without physical hardware.

### C. `SerialEsp32Adapter`
- Real UART/USB serial communication adapter via `pyserial`.
- Normalizes physical serial exceptions into canonical hardware error codes:
  - `PORT_NOT_FOUND`
  - `PORT_BUSY`
  - `PERMISSION_DENIED`
  - `OPEN_FAILED`
  - `READ_TIMEOUT`
  - `WRITE_TIMEOUT`
  - `DISCONNECTED`
  - `PROTOCOL_ERROR`
  - `DEVICE_ERROR`
