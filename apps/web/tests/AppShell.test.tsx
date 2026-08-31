import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";
import { ModeProvider } from "@/components/providers/ModeProvider";

describe("AppShell", () => {
  it("renders branding title and navigation sidebar items", () => {
    render(
      <ModeProvider>
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      </ModeProvider>,
    );

    expect(screen.getByText(/neuromove/i)).toBeInTheDocument();
    expect(screen.getByText("Live Control")).toBeInTheDocument();
    expect(screen.getByText("EEG Stream")).toBeInTheDocument();
    expect(screen.getByText("Safety Engine")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });
});
