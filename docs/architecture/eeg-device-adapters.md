# EEG Device Adapters Architecture

## 1. Adapter Abstraction Hierarchy

Phase 21 establishes an extensible, import-safe adapter hierarchy deriving from `EegAcquisitionAdapter`:

```python
class EegAcquisitionAdapter(ABC):
    @abstractmethod
    def discover(self) -> list[EegDeviceDescriptor]: ...
    @abstractmethod
    def connect(self, device_id: str | None = None) -> bool: ...
    @abstractmethod
    def disconnect(self) -> bool: ...
    @abstractmethod
    def start_stream(self) -> bool: ...
    @abstractmethod
    def pause_stream(self) -> bool: ...
    @abstractmethod
    def resume_stream(self) -> bool: ...
    @abstractmethod
    def stop_stream(self) -> bool: ...
    @abstractmethod
    def read_chunk(self) -> EegSamplePacket | None: ...
    @abstractmethod
    def get_status(self) -> EegAcquisitionState: ...
    @abstractmethod
    def get_health(self) -> EegStreamHealthSnapshot: ...
```

## 2. Supported Adapter Implementations

### A. `SimulatedEegAcquisitionAdapter`
- **Purpose**: Generates high-fidelity synthetic 8-channel EEG at 250 Hz with realistic 1/f pink noise and motor-imagery ERD/ERS dynamics.
- **Intent Modulation**: Supports programmable intention modulation (`MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`, `STOP`, `IDLE`) by altering mu (8–12 Hz) and beta (16–24 Hz) spectral power over C3 and C4 channels.
- **Fault Injection**: Allows programmatic injection of hardware defects (`FLATLINE_CHANNEL`, `SATURATION_CHANNEL`, `NOISE_BURST`, `PACKET_DROP`) for robustness verification.

### B. `RecordedEegAcquisitionAdapter`
- **Purpose**: Ingests compact, SHA-256 verified JSON/EDF fixtures (`compact_eeg_fixture.json`) for offline verification and reproducible test runs.
- **Lineage Verification**: Recomputes fixture SHA-256 digest on load and rejects corrupted or modified fixtures.
- **Playback Control**: Supports loop replay, custom speed multipliers, and sample seek operations.

### C. `PhysicalEegAcquisitionAdapter`
- **Purpose**: Interface for physical BioAmp EXG sensors, OpenBCI Cyton/Ganglion boards, and LSL data streams.
- **Safe Probing**: Scans system serial/COM ports using `pyserial` without blocking or asserting control signals.
- **Honest Availability**: Returns `is_available: False` if no physical BioAmp hardware signature is detected. Never pretends hardware is connected when absent.
