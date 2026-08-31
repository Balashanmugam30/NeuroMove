import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AppShell } from "../components/layout/AppShell";
import { ModeProvider } from "../components/providers/ModeProvider";

describe("AppShell Layout", () => {
  it("renders topbar, sidebar navigation, and main content", () => {
    render(
      <ModeProvider>
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      </ModeProvider>,
    );

    expect(screen.getByText(/neuromove/i)).toBeInTheDocument();
    expect(screen.getByText("Live Control")).toBeInTheDocument();
    expect(screen.getByText("EEG Lab")).toBeInTheDocument();
    expect(screen.getByText("Safety Engine")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });
});
