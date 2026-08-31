import { describe, it, expect, beforeEach } from "vitest";
import { EEGRingBuffer } from "../lib/realtime/EEGRingBuffer";

describe("EEGRingBuffer", () => {
  let ringBuffer: EEGRingBuffer;

  beforeEach(() => {
    ringBuffer = new EEGRingBuffer(10, ["C3", "Cz", "C4"]);
  });

  it("initializes with zero samples pushed", () => {
    expect(ringBuffer.getCapacity()).toBe(10);
    expect(ringBuffer.getTotalSamplesPushed()).toBe(0);
    expect(ringBuffer.getLatestSample("C3")).toBe(0);
  });

  it("pushes individual samples and tracks total count", () => {
    ringBuffer.pushSample("C3", 1.5);
    ringBuffer.pushSample("C3", 2.5);
    expect(ringBuffer.getTotalSamplesPushed()).toBe(2);
    expect(ringBuffer.getLatestSample("C3")).toBe(2.5);
  });

  it("pushes multi-channel chunk arrays accurately", () => {
    ringBuffer.pushChunk({
      C3: [1.0, 2.0, 3.0],
      Cz: [0.5, 0.6, 0.7],
      C4: [-1.0, -2.0, -3.0],
    });

    expect(ringBuffer.getLatestSample("C3")).toBeCloseTo(3.0);
    expect(ringBuffer.getLatestSample("Cz")).toBeCloseTo(0.7);
    expect(ringBuffer.getLatestSample("C4")).toBeCloseTo(-3.0);
  });

  it("correctly wraps around circular buffer without overflow", () => {
    // Capacity is 10. Push 15 samples: 0..14
    for (let i = 0; i < 15; i++) {
      ringBuffer.pushSample("C3", i);
    }

    expect(ringBuffer.getTotalSamplesPushed()).toBe(15);
    expect(ringBuffer.getLatestSample("C3")).toBe(14);

    const ordered = ringBuffer.getOrderedChannelData("C3");
    expect(ordered.length).toBe(10);
    // Oldest sample in the 10-sample window should be 5, newest should be 14
    expect(ordered[0]).toBe(5);
    expect(ordered[9]).toBe(14);
  });

  it("clears all buffers back to zero", () => {
    ringBuffer.pushSample("C3", 42.0);
    ringBuffer.clear();
    expect(ringBuffer.getTotalSamplesPushed()).toBe(0);
    expect(ringBuffer.getLatestSample("C3")).toBe(0);
  });
});
