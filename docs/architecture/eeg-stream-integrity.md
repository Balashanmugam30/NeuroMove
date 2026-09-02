# EEG Stream Integrity & Clock Normalization Architecture

## 1. Clock & Monotonicity Normalization

Physical EEG sensors deliver samples timestamped by embedded device oscillators which suffer from drift and jitter relative to host wall-clock time. `EegClockNormalizer` resolves these discrepancies:

1. **Monotonicity Enforcement**: Asserts that successive sample timestamps satisfy $t_{k} > t_{k-1}$. Detects backward jumps and increments discontinuity counters.
2. **Clock Offset Estimation**: Tracks the offset $\Delta t = t_{\text{host}} - t_{\text{device}}$ using rolling linear regression.
3. **Drift Computation (PPM)**: Measures oscillator frequency deviation in parts-per-million (PPM):
   $$\text{Drift (PPM)} = \left( \frac{\Delta t_{\text{measured}} - \Delta t_{\text{nominal}}}{\Delta t_{\text{nominal}}} \right) \times 10^6$$
4. **Discontinuity Recovery**: Automatically re-anchors the base timeline on session restarts or hardware packet gaps.

## 2. Bounded Ring Buffer Management

Memory safety and bounded latency require strict limits on in-memory buffers:

- **Thread Safety**: Uses recursive mutex locks (`threading.Lock`) for concurrent ingestion and extraction.
- **Fixed Time Duration**: Configured to hold a bounded window (default: 10.0 seconds = 2500 samples @ 250 Hz).
- **Overflow & Drop Accounting**: When new samples arrive and buffer capacity is exceeded, oldest samples are discarded with rigorous drop counters and overflow event logging.
- **Recent Window Extraction**: Supports zero-copy extraction of recent $N$ samples across all $C$ channels for downstream DSP and epoching.
