"use client";

import React, { useState } from "react";
import {
  HardwareStatus,
  ExecutionAuthorization,
} from "@neuromove/contracts";
import {
  Terminal,
  Send,
  Loader2,
  FileCheck2,
} from "lucide-react";

interface CommandVerificationConsoleProps {
  status: HardwareStatus | null;
  onValidate: (auth: ExecutionAuthorization) => Promise<{
    valid: boolean;
    reason_code: string;
    message: string;
    will_transmit: boolean;
  }>;
  onRunCommand: (payload: {
    command_type: string;
    intent_class: string;
    subject_id: string;
    authorization: ExecutionAuthorization;
  }) => Promise<any>;
  isLoading?: boolean;
}

export function CommandVerificationConsole({
  status,
  onValidate,
  onRunCommand,
  isLoading,
}: CommandVerificationConsoleProps) {
  const [intentClass, setIntentClass] = useState<string>("MOVE_FORWARD");
  const [decision, setDecision] = useState<"AUTHORIZED" | "DENIED" | "HELD" | "EMERGENCY_STOP">("AUTHORIZED");
  const [subjectId, setSubjectId] = useState<string>("sub-01");
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    reason_code: string;
    message: string;
    will_transmit: boolean;
  } | null>(null);

  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const createAuthPayload = (): ExecutionAuthorization => {
    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = isExpired
      ? new Date(now.getTime() - 60000).toISOString()
      : new Date(now.getTime() + 60000).toISOString();

    return {
      authorization_id: `auth_ui_${Math.random().toString(36).substring(2, 9)}`,
      intent_id: `int_ui_${Math.random().toString(36).substring(2, 9)}`,
      intent_class: intentClass,
      decision: decision as any,
      policy_version: "1.0",
      evaluation_id: `eval_ui_${Math.random().toString(36).substring(2, 9)}`,
      model_version_id: "csp_lda_v1",
      subject_id: subjectId,
      session_id: status?.session_id || "sess_hw_01",
      issued_at: issuedAt,
      expires_at: expiresAt,
      reason: "HIL Laboratory Command Verification Console",
    };
  };

  const handleValidate = async () => {
    setActionLoading(true);
    try {
      const auth = createAuthPayload();
      const res = await onValidate(auth);
      setValidationResult(res);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunCommand = async () => {
    setActionLoading(true);
    try {
      const auth = createAuthPayload();
      const res = await onRunCommand({
        command_type: intentClass === "STOP" ? "STOP" : "EXECUTE_INTENT",
        intent_class: intentClass,
        subject_id: subjectId,
        authorization: auth,
      });
      setExecutionResult(res);
    } finally {
      setActionLoading(false);
    }
  };

  const isPreFlightAuthorized = decision === "AUTHORIZED" && !isExpired;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-sans">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              HIL Command Pipeline & Authorization Gate
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              End-to-end command construction, Phase 17 safety verification & serial transmission
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
            isPreFlightAuthorized
              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400"
          }`}
        >
          {isPreFlightAuthorized ? "GATE: AUTHORIZED" : "GATE: BLOCKED"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Command Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Canonical Intent Class
            </label>
            <select
              value={intentClass}
              onChange={(e) => setIntentClass(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              {["MOVE_FORWARD", "MOVE_BACKWARD", "TURN_LEFT", "TURN_RIGHT", "STOP", "ROTATE_CCW", "CANCEL_INTENT"].map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Phase 17 Safety Decision
            </label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              {["AUTHORIZED", "DENIED", "HELD", "EMERGENCY_STOP"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Subject Identifier
            </label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isExpired}
                onChange={(e) => setIsExpired(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Simulate Expired Token</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleValidate}
            disabled={actionLoading || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
            Pre-Flight Safety Validation
          </button>

          <button
            type="button"
            onClick={handleRunCommand}
            disabled={actionLoading || isLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Transmit HIL Command
          </button>
        </div>

        {/* Live Validation & Execution Inspector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Pre-flight Result */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Pre-Flight Gate Result</span>
              {validationResult ? (
                validationResult.valid ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">VALID</span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">REJECTED</span>
                )
              ) : (
                <span className="text-slate-400 font-normal">Pending test</span>
              )}
            </div>
            {validationResult ? (
              <div className="font-mono text-[11px] space-y-0.5 text-slate-600 dark:text-slate-400">
                <div>Reason: <span className="font-bold">{validationResult.reason_code}</span></div>
                <div>Will Transmit: {validationResult.will_transmit ? "YES" : "NO (0 TX)"}</div>
                <div>Message: {validationResult.message}</div>
              </div>
            ) : (
              <div className="text-slate-400 italic">Click Pre-Flight Safety Validation to verify rules.</div>
            )}
          </div>

          {/* Execution Result */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>HIL Pipeline Response</span>
              {executionResult ? (
                executionResult.status === "COMMAND_ACCEPTED" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">ACCEPTED</span>
                ) : executionResult.status === "COMMAND_REJECTED" ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">REJECTED</span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">NACK</span>
                )
              ) : (
                <span className="text-slate-400 font-normal">No command sent</span>
              )}
            </div>
            {executionResult ? (
              <div className="font-mono text-[11px] space-y-0.5 text-slate-600 dark:text-slate-400">
                <div>Status: <span className="font-bold">{executionResult.status}</span></div>
                <div>Transmissions: {executionResult.transmission_count}</div>
                <div>Command ID: {executionResult.command_id || "None (Blocked)"}</div>
                {executionResult.reason && <div>Reason: {executionResult.reason}</div>}
              </div>
            ) : (
              <div className="text-slate-400 italic">Click Transmit HIL Command to run through active adapter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
