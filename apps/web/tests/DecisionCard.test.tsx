import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionCard } from "@/components/ui/DecisionCard";

describe("DecisionCard", () => {
  it("renders safety decision, intent, and confidence accurately", () => {
    render(
      <DecisionCard
        intent="RIGHT"
        confidence={0.92}
        decision="APPROVED"
        risk="SAFE"
        runtimeState="CONFIRMED"
        rationale="Clear motor-imagery mu desynchronization"
      />,
    );

    expect(screen.getByTestId("decision-card")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(
      screen.getByText("Clear motor-imagery mu desynchronization"),
    ).toBeInTheDocument();
  });
});
