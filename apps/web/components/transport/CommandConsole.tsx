"use client";

import React, { useState } from "react";
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Layers,
  Code2,
} from "lucide-react";
import { ExecutionAuthorization } from "@neuromove/contracts";

interface CommandConsoleProps {
  onSendCommand: (auth: ExecutionAuthorization) => Promise<any>;
  onCancelCommand: (commandId: string) => Promise<any>;
  commands: any[];
  isLoading?: boolean;
}

export function CommandConsole({
  onSendCommand,
  onCancelCommand,
  commands,
  isLoading = false,
}: CommandConsoleProps) {
  // Command form inputs
  const [intentClass, setIntentClass] = useState<string>("MOVE_FORWARD");
  const [safetyDecision, setSafetyDecision] = useState<string>("AUTHORIZED");
  const [sessionId, setSessionId] = useState<string>("sess-01");
  const [subjectId, setSubjectId] = useState<string>("sub-01");
  const [modelVersionId, _setModelVersionId] = useState<string>("csp_lda_v1");
  const [expireSeconds, _setExpireSeconds] = useState<number>(10);
  const [isExpiredSimulation, setIsExpiredSimulation] = useState<boolean>(false);

  // Transmission response state
  const [transmissionResult, setTransmissionResult] = useState<any | null>(null);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  const buildAuthorization = (): ExecutionAuthorization => {
    const now = new Date();
    const issuedAt = isExpiredSimulation
      ? new Date(now.getTime() - 20000).toISOString()
      : now.toISOString();
    const expiresAt = isExpiredSimulation
      ? new Date(now.getTime() - 10000).toISOString()
      : new Date(now.getTime() + expireSeconds * 1000).toISOString();

    return {
      authorization_id: `auth_${Math.random().toString(36).substring(2, 10)}`,
      intent_id: `int_${Math.random().toString(36).substring(2, 10)}`,
      intent_class: intentClass,
      decision: safetyDecision as any,
      policy_version: "1.0.0",
      evaluation_id: `eval_${Math.random().toString(36).substring(2, 10)}`,
      model_version_id: modelVersionId,
      subject_id: subjectId,
      session_id: sessionId,
      issued_at: issuedAt,
      expires_at: expiresAt,
      reason: `Operator console selection: ${safetyDecision}`,
    };
  };

  const handleTransmit = async () => {
    setIsTransmitting(true);
    setTransmissionResult(null);
    try {
      const auth = buildAuthorization();
      const res = await onSendCommand(auth);
      setTransmissionResult(res);
    } catch (err: any) {
      setTransmissionResult({
        transmitted: false,
        status: "FAILED",
        message: err.message || "Failed to transmit command",
      });
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Upper Grid: Command Construction & Frame Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Col: Upstream Authorization Input Form */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Upstream Execution Authorization (Phase 17 Gate)
                </h4>
                <p className="text-xs text-slate-500">
                  Protocol framing validates upstream decision before wire encapsulation
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                safetyDecision === "AUTHORIZED"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {safetyDecision}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Intent Class</label>
              <select
                value={intentClass}
                onChange={(e) => setIntentClass(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="MOVE_FORWARD">MOVE_FORWARD</option>
                <option value="MOVE_BACKWARD">MOVE_BACKWARD</option>
                <option value="TURN_LEFT">TURN_LEFT</option>
                <option value="TURN_RIGHT">TURN_RIGHT</option>
                <option value="STOP">STOP</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Safety Decision</label>
              <select
                value={safetyDecision}
                onChange={(e) => setSafetyDecision(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="AUTHORIZED">AUTHORIZED (Permits Transmit)</option>
                <option value="DENIED">DENIED (Strict Zero Transmit)</option>
                <option value="HELD">HELD (Zero Transmit)</option>
                <option value="EMERGENCY_STOP">EMERGENCY_STOP (Zero Transmit)</option>
                <option value="LOCKED_OUT">LOCKED_OUT (Zero Transmit)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Subject ID</label>
              <input
                type="text"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isExpiredSimulation}
                onChange={(e) => setIsExpiredSimulation(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Simulate Stale / Expired Authorization
            </label>

            <button
              type="button"
              onClick={handleTransmit}
              disabled={isTransmitting || isLoading}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${
                safetyDecision === "AUTHORIZED" && !isExpiredSimulation
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-700 hover:bg-slate-800 text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {safetyDecision === "AUTHORIZED" && !isExpiredSimulation
                ? "Transmit to Simulator"
                : "Transmit (Expect Safety Rejection)"}
            </button>
          </div>

          {safetyDecision !== "AUTHORIZED" && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Safety decision is <strong>{safetyDecision}</strong>. Invariant 1 dictates zero transport frames will be constructed.
              </span>
            </div>
          )}
        </div>

        {/* Right Col: Frame Encapsulation Preview & Last Response */}
        <div className="lg:col-span-6 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800">
              <Code2 className="w-4 h-4 text-teal-600" />
              Wire Frame Wire-Format Inspection
            </div>
            <span className="text-3xs font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
              DELIMITERS: 0xAA55 ... 0x55AA
            </span>
          </div>

          <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto space-y-1.5 border border-slate-800 shadow-inner">
            <div className="text-slate-500">{/* Header: [START: 2B] [LEN: 4B] [CRC32: 8B] */}</div>
            <div className="text-teal-300">
              0xAA55 &bull; LEN=248B &bull; CRC32=[AUTO-COMPUTED]
            </div>
            <div className="text-slate-500">{/* Serialized Canonical JSON Payload */}</div>
            <div className="text-emerald-400 whitespace-pre-wrap">
              {JSON.stringify(
                {
                  protocol_version: "1.0",
                  intent_class: intentClass,
                  session_id: sessionId,
                  subject_id: subjectId,
                  decision: safetyDecision,
                  flags: { software_simulation: true, authorized: safetyDecision === "AUTHORIZED" },
                },
                null,
                2
              )}
            </div>
            <div className="text-teal-300">0x55AA // Frame Trailer</div>
          </div>

          {/* Response Box */}
          {transmissionResult && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1 ${
                transmissionResult.status === "ACKED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : transmissionResult.status === "DUPLICATE"
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {transmissionResult.status === "ACKED" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                  )}
                  Transmission Result: {transmissionResult.status}
                </span>
                <span className="font-mono text-3xs font-bold">
                  {transmissionResult.rtt_ms ? `${transmissionResult.rtt_ms}ms` : ""}
                </span>
              </div>
              <p className="text-2xs">
                {transmissionResult.reason || transmissionResult.message || transmissionResult.error || "Completed"}
              </p>
              {transmissionResult.command_id && (
                <div className="text-3xs font-mono text-slate-500">
                  Command ID: {transmissionResult.command_id} &bull; Sequence: {transmissionResult.sequence_number}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lower Section: Recent Commands Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-900">Recent Command Audit Log</h4>
          </div>
          <span className="text-xs text-slate-500">
            {commands.length} commands logged in SQLite (Migration 013)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-3">Command ID</th>
                <th className="py-2.5 px-3">Intent Class</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Sequence</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Issued At</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {commands.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                    No commands transmitted yet. Transmit an authorized command above.
                  </td>
                </tr>
              ) : (
                commands.map((cmd) => (
                  <tr key={cmd.command_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900">{cmd.command_id}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {cmd.command_type}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          cmd.status === "ACKED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : cmd.status === "DUPLICATE"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : cmd.status === "REJECTED" || cmd.status === "FAILED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">#{cmd.last_sequence}</td>
                    <td className="py-2 px-3">{cmd.attempt_count}</td>
                    <td className="py-2 px-3 text-slate-500 font-sans text-[11px]">
                      {new Date(cmd.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {cmd.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => onCancelCommand(cmd.command_id)}
                          className="px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
