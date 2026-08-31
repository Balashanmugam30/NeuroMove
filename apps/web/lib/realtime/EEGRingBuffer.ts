/**
 * NeuroMove High-Performance Bounded EEG Multi-Channel Ring Buffer.
 *
 * Stores streaming continuous electrophysiological samples with zero-copy
 * Float32Array circular memory buffers, decoupling network ingestion from UI rendering.
 */

export class EEGRingBuffer {
  private capacity: number;
  private channels: string[];
  private buffers: Map<string, Float32Array>;
  private writePointers: Map<string, number>;
  private totalSamplesPushed = 0;

  constructor(capacity = 1000, channels = ["C3", "Cz", "C4"]) {
    this.capacity = capacity;
    this.channels = channels;
    this.buffers = new Map();
    this.writePointers = new Map();

    for (const ch of channels) {
      this.buffers.set(ch, new Float32Array(capacity));
      this.writePointers.set(ch, 0);
    }
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getTotalSamplesPushed(): number {
    return this.totalSamplesPushed;
  }

  public pushSample(channel: string, sample: number): void {
    let buf = this.buffers.get(channel);
    if (!buf) {
      buf = new Float32Array(this.capacity);
      this.buffers.set(channel, buf);
      this.writePointers.set(channel, 0);
    }

    const ptr = this.writePointers.get(channel) || 0;
    buf[ptr] = sample;
    this.writePointers.set(channel, (ptr + 1) % this.capacity);
    this.totalSamplesPushed++;
  }

  public pushChunk(channelsData: Record<string, number[]>): void {
    for (const [ch, samples] of Object.entries(channelsData)) {
      if (!Array.isArray(samples)) continue;
      for (let i = 0; i < samples.length; i++) {
        this.pushSample(ch, samples[i]);
      }
    }
  }

  public getOrderedChannelData(channel: string): Float32Array {
    const buf = this.buffers.get(channel);
    if (!buf) return new Float32Array(0);

    const ptr = this.writePointers.get(channel) || 0;
    const output = new Float32Array(this.capacity);

    // Copy oldest-to-newest in chronological sequence
    const tailLen = this.capacity - ptr;
    output.set(buf.subarray(ptr, this.capacity), 0);
    output.set(buf.subarray(0, ptr), tailLen);

    return output;
  }

  public getLatestSample(channel: string): number {
    const buf = this.buffers.get(channel);
    if (!buf) return 0;
    const ptr = this.writePointers.get(channel) || 0;
    const lastIdx = (ptr - 1 + this.capacity) % this.capacity;
    return buf[lastIdx];
  }

  public clear(): void {
    for (const ch of this.buffers.keys()) {
      this.buffers.get(ch)!.fill(0);
      this.writePointers.set(ch, 0);
    }
    this.totalSamplesPushed = 0;
  }
}
