import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Notice";
import { InsightCard } from "../components/ui/InsightCard";
import { FreshnessIndicator } from "../components/ui/FreshnessIndicator";
import { DecisionExplanation } from "../components/ui/DecisionExplanation";
import { DataTable } from "../components/ui/DataTable";
import { Input, Select, Switch, SegmentedControl } from "../components/ui/FormControls";

describe("Design System 2.0 Components", () => {
  describe("Button", () => {
    it("renders with different variants and triggers onClick", () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" onClick={handleClick}>
          Execute Command
        </Button>
      );

      const btn = screen.getByRole("button", { name: /execute command/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("handles disabled and loading states correctly", () => {
      render(
        <Button variant="destructive" disabled loading>
          Stop Motor
        </Button>
      );
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });
  });

  describe("Notice", () => {
    it("renders notice with variant styling", () => {
      render(
        <Notice variant="warning" title="Warning Notice">
          Telemetry packet rate degraded.
        </Notice>
      );
      expect(screen.getByText("Warning Notice")).toBeInTheDocument();
      expect(screen.getByText("Telemetry packet rate degraded.")).toBeInTheDocument();
    });
  });

  describe("InsightCard", () => {
    it("renders insight card with title and children", () => {
      render(
        <InsightCard title="SMR Calibration Scientific Context" variant="accent">
          C3 and C4 spatial filters maximize classification margin.
        </InsightCard>
      );
      expect(screen.getByText("SMR Calibration Scientific Context")).toBeInTheDocument();
      expect(
        screen.getByText("C3 and C4 spatial filters maximize classification margin.")
      ).toBeInTheDocument();
    });
  });

  describe("FreshnessIndicator", () => {
    it("renders explicit freshness status", () => {
      render(<FreshnessIndicator status="FRESH" />);
      expect(screen.getByText("FRESH")).toBeInTheDocument();
    });
  });

  describe("DecisionExplanation", () => {
    it("renders safety decision verdict and gate checklist", () => {
      render(
        <DecisionExplanation
          decision="APPROVED"
          risk="SAFE"
          runtimeState="EXECUTING"
          rationale="Trajectory verified clear"
        />
      );
      expect(screen.getByText(/safety arbitration verdict/i)).toBeInTheDocument();
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
      expect(screen.getByText("Trajectory verified clear")).toBeInTheDocument();
    });
  });

  describe("DataTable", () => {
    it("renders accessible tabular records and empty state", () => {
      const columns = [
        { key: "id", header: "ID" },
        { key: "label", header: "Label" },
      ];
      const data = [{ id: "1", label: "Item One" }];

      const { rerender } = render(<DataTable columns={columns} data={data} />);
      expect(screen.getByText("Item One")).toBeInTheDocument();

      rerender(<DataTable columns={columns} data={[]} emptyTitle="No Data Found" />);
      expect(screen.getByText("No Data Found")).toBeInTheDocument();
    });
  });

  describe("FormControls", () => {
    it("renders input, select, switch, and segmented control", () => {
      const handleSwitch = vi.fn();
      const handleSegment = vi.fn();

      render(
        <div>
          <Input label="Subject Name" defaultValue="Subj_01" />
          <Select label="Filter Order" defaultValue="4">
            <option value="2">2nd Order</option>
            <option value="4">4th Order</option>
          </Select>
          <Switch label="Artifact Removal" checked={true} onChange={handleSwitch} />
          <SegmentedControl
            value="PRODUCT"
            onChange={handleSegment}
            options={[
              { value: "PRODUCT", label: "Product" },
              { value: "RESEARCH", label: "Research" },
            ]}
          />
        </div>
      );

      expect(screen.getByLabelText("Subject Name")).toHaveValue("Subj_01");
      expect(screen.getByLabelText("Filter Order")).toHaveValue("4");
      expect(screen.getByText("Artifact Removal")).toBeInTheDocument();
      expect(screen.getByText("Product")).toBeInTheDocument();
      expect(screen.getByText("Research")).toBeInTheDocument();
    });
  });
});
