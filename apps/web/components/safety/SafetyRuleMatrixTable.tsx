"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, PauseCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { SafetyEvaluation, SafetyRuleResult } from "@neuromove/contracts";

interface RuleMeta {
  rule_id: string;
  category: string;
  precedence_rank: number;
  description: string;
}

const STATIC_RULES: RuleMeta[] = [
  { rule_id: "RULE_01_EMERGENCY_STOP", category: "EMERGENCY_STOP", precedence_rank: 1, description: "Software Emergency Stop Active Gate" },
  { rule_id: "RULE_02_LOCKOUT", category: "LOCKOUT", precedence_rank: 2, description: "System Safety Lockout Gate" },
  { rule_id: "RULE_03_INPUT_VALIDITY", category: "MALFORMED_INPUT", precedence_rank: 3, description: "Well-formed Intent Payload Structure Validation" },
  { rule_id: "RULE_04_CRITICAL_HEALTH", category: "HEALTH", precedence_rank: 4, description: "Critical Subsystem Health Check (Fail-Closed on Unknown)" },
  { rule_id: "RULE_05_STREAM_HEALTH", category: "STREAM", precedence_rank: 6, description: "Realtime Telemetry & Stream Latency Boundary" },
  { rule_id: "RULE_06_INTENT_ELIGIBILITY", category: "ELIGIBILITY", precedence_rank: 5, description: "Intent State Eligibility (Only ACTIVE is Eligible)" },
  { rule_id: "RULE_07_INTENT_ALLOWLIST", category: "ALLOWLIST", precedence_rank: 5, description: "Allowlisted vs Blocked Intent Class Gate" },
  { rule_id: "RULE_08_INTENT_FRESHNESS", category: "FRESHNESS", precedence_rank: 6, description: "Intent Timestamp Freshness Boundary (500ms max)" },
  { rule_id: "RULE_09_MODEL_PROVENANCE", category: "MODEL", precedence_rank: 6, description: "Originating Decoder Model Provenance & Status" },
  { rule_id: "RULE_10_EVIDENCE_PROVENANCE", category: "PROVENANCE", precedence_rank: 6, description: "Upstream Confidence & Session Context Reference" },
  { rule_id: "RULE_11_OPERATOR_HOLD", category: "OPERATOR", precedence_rank: 7, description: "Manual Operator Hold Condition" },
  { rule_id: "RULE_12_RATE_LIMIT", category: "RATE_LIMIT", precedence_rank: 5, description: "Sliding Window Command Rate & Gap Limiter" },
  { rule_id: "RULE_13_ACTIVE_DURATION", category: "DURATION_LIMIT", precedence_rank: 5, description: "Continuous Active Execution Duration Boundary" },
];

interface SafetyRuleMatrixTableProps {
  evaluation: SafetyEvaluation | null;
  rules?: any[];
}

export const SafetyRuleMatrixTable: React.FC<SafetyRuleMatrixTableProps> = ({ evaluation }) => {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Map latest rule outcomes from evaluation
  const passedMap = new Map<string, SafetyRuleResult>();
  const violatedMap = new Map<string, SafetyRuleResult>();

  if (evaluation) {
    evaluation.passed_rules.forEach((r) => passedMap.set(r.rule_id, r));
    evaluation.violated_rules.forEach((r) => violatedMap.set(r.rule_id, r));
  }

  const getStatusBadge = (ruleId: string) => {
    if (!evaluation) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
          <Info className="w-3.5 h-3.5" /> Standby
        </span>
      );
    }
    const violation = violatedMap.get(ruleId);
    if (violation) {
      if (violation.status === "HOLD") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <PauseCircle className="w-3 h-3" /> HELD
          </span>
        );
      }
      if (violation.status === "WARN") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
            <AlertTriangle className="w-3 h-3" /> WARN
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> FAIL
        </span>
      );
    }

    if (passedMap.has(ruleId)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> PASS
        </span>
      );
    }

    return <span className="text-slate-400 text-xs">N/A</span>;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-base font-bold text-slate-900">Deterministic Safety Rule Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            13 software constraints evaluated with strict fail-safe precedence (Rank 1 dominates).
          </p>
        </div>
        {evaluation && (
          <div className="text-right">
            <span className="text-xs font-medium text-slate-500">Evaluation: </span>
            <span className="text-xs font-mono font-semibold text-slate-800">
              {evaluation.evaluation_id} ({evaluation.duration_ms.toFixed(2)}ms)
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <th className="py-3 px-4 w-12 text-center">Rank</th>
              <th className="py-3 px-4">Rule Identifier</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Reason / Outcome</th>
              <th className="py-3 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STATIC_RULES.map((rule) => {
              const res = violatedMap.get(rule.rule_id) || passedMap.get(rule.rule_id);
              const isExpanded = expandedRule === rule.rule_id;

              return (
                <React.Fragment key={rule.rule_id}>
                  <tr
                    onClick={() => setExpandedRule(isExpanded ? null : rule.rule_id)}
                    className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                      violatedMap.has(rule.rule_id) ? "bg-rose-50/30" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {rule.precedence_rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {rule.rule_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {rule.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {rule.description}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(rule.rule_id)}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {res ? (
                        <span className="truncate max-w-sm block">
                          <span className="font-mono text-slate-500 font-normal mr-1">
                            [{res.reason_code}]
                          </span>
                          {res.message}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not evaluated</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                  </tr>
                  {isExpanded && res && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan={7} className="p-4 pl-14">
                        <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-100 font-sans">
                            <span className="font-semibold text-slate-700">Rule Audit Evidence</span>
                            <span>Evaluated: {new Date(res.evaluated_at).toLocaleString()}</span>
                          </div>
                          <pre className="text-[11px] text-slate-800 overflow-x-auto pt-1">
                            {JSON.stringify(res.evidence, null, 2)}
                          </pre>
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
};
