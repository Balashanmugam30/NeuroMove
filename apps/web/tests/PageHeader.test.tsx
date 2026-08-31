import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../components/ui/PageHeader";

describe("PageHeader Component", () => {
  it("renders category, title, description, and mode badge", () => {
    render(
      <PageHeader
        category="Control Station"
        title="Test Command Center"
        description="A test page description for testing purposes"
        mode="SIMULATION"
        actions={<button>Test Action</button>}
      />
    );

    expect(screen.getByText("Control Station")).toBeInTheDocument();
    expect(screen.getByText("Test Command Center")).toBeInTheDocument();
    expect(screen.getByText("A test page description for testing purposes")).toBeInTheDocument();
    expect(screen.getByText(/simulation/i)).toBeInTheDocument();
    expect(screen.getByText("Test Action")).toBeInTheDocument();
  });
});
