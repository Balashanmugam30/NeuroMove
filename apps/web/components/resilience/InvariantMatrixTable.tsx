"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { InvariantResult } from "@neuromove/contracts";

interface InvariantMatrixTableProps {
  invariants: InvariantResult[];
}

export function InvariantMatrixTable({ invariants }: InvariantMatrixTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const passCount = invariants.filter((inv) => inv.status === "PASS").length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Formal Platform Invariants Matrix</h3>
            <p className="text-xs text-slate-500">14 platform integrity constraints evaluated under perturbation</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
            {passCount} / {invariants.length} Passed
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">
            Zero Tolerance Fail-Closed
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-10"></th>
              <th className="py-2.5 px-3">Invariant ID & Name</th>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Observed Value</th>
              <th className="py-2.5 px-3">Expected Value</th>
              <th className="py-2.5 px-3 text-right">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {invariants.map((inv) => {
              const isExpanded = expandedId === inv.invariant_id;
              return (
                <React.Fragment key={inv.invariant_id}>
                  <tr
                    onClick={() => toggleExpand(inv.invariant_id)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{inv.name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{inv.invariant_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          inv.severity === "CRITICAL"
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {inv.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 truncate max-w-xs">
                      {inv.observed_value}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                      {inv.expected_value}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <VerdictBadge status={inv.status} />
                    </td>
                  </tr>

                  {/* Expanded Evidence Drawer */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={6} className="p-4 border-b border-slate-200 text-xs">
                        <div className="font-semibold text-slate-800 mb-1">Cryptographic Evidence & State:</div>
                        <pre className="p-3 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800 overflow-x-auto">
                          {JSON.stringify(inv.evidence, null, 2)}
                        </pre>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Evaluated at: {inv.timestamp}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerdictBadge({ status }: { status: string }) {
  if (status === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        PASS
      </span>
    );
  }
  if (status === "FAIL") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        FAIL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
      UNCERTAIN
    </span>
  );
}
