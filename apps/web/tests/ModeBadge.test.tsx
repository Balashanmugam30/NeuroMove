import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModeBadge } from "@/components/ui/ModeBadge";

describe("ModeBadge", () => {
  it("renders SIMULATION mode badge clearly", () => {
    render(<ModeBadge mode="SIMULATION" />);
    const badge = screen.getByTestId("mode-badge");
    expect(badge).toHaveTextContent(/simulation/i);
  });

  it("renders LIVE mode badge with indicators", () => {
    render(<ModeBadge mode="LIVE" />);
    const badge = screen.getByTestId("mode-badge");
    expect(badge).toHaveTextContent(/live/i);
  });

  it("renders REPLAY mode badge", () => {
    render(<ModeBadge mode="REPLAY" />);
    const badge = screen.getByTestId("mode-badge");
    expect(badge).toHaveTextContent(/replay/i);
  });
});
