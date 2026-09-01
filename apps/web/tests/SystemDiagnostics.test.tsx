import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SystemDiagnosticsPage from "../app/system/page";
import { ModeProvider } from "../components/providers/ModeProvider";
import { RealtimeProvider } from "../components/providers/RealtimeProvider";
import { formatTimestamp } from "../lib/utils";

// Mock API client to control system status
vi.mock("../lib/api-client", () => ({
  fetchSystemStatus: vi.fn().mockImplementation(
    () => new Promise(() => {}) // pending promise so initial render state is tested
  ),
}));

describe("System Diagnostics Page Hydration & Determinism", () => {
  it("renders deterministic placeholder for Last Heartbeat on initial render", () => {
    render(
      <ModeProvider>
        <RealtimeProvider>
          <SystemDiagnosticsPage />
        </RealtimeProvider>
      </ModeProvider>
    );

    expect(screen.getByText("System Diagnostics & Transport Telemetry")).toBeInTheDocument();
    expect(screen.getByText("Awaiting heartbeat")).toBeInTheDocument();
  });

  it("formats timestamps deterministically across timezones", () => {
    const formatted = formatTimestamp("2026-09-01T08:11:50.670Z");
    expect(formatted).toBe("08:11:50");

    const empty = formatTimestamp("");
    expect(empty).toBe("--:--:--");
  });
});
