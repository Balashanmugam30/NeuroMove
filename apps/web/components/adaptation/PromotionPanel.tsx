"use client";

import React, { useState } from "react";
import { AdaptationRun } from "@neuromove/contracts";
import { CheckCircle2, XCircle, ShieldAlert, Award, XSquare } from "lucide-react";

interface PromotionPanelProps {
  currentRun: AdaptationRun | null;
  onPromote: (notes?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  isProcessing: boolean;
  isResearchMode?: boolean;
}

export const PromotionPanel: React.FC<PromotionPanelProps> = ({
  currentRun,
  onPromote,
  onReject,
  isProcessing,
}) => {

  const [operatorNotes, setOperatorNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  if (!currentRun || !currentRun.candidate_model_id) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500 shadow-sm">
        No candidate model pending promotion review. Complete an adaptation run to proceed.
      </div>
    );
  }

  const eligibility = currentRun.promotion_eligibility;
  const isEligible = eligibility?.is_eligible ?? false;
  const isAlreadyDecided = ["PROMOTED", "REJECTED"].includes(currentRun.status);

  const handlePromote = async () => {
    await onPromote(operatorNotes);
    setOperatorNotes("");
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    await onReject(rejectionReason);
    setRejectionReason("");
    setShowRejectModal(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-sm">
            Candidate Model Promotion & Governance Gate
          </h3>
        </div>
        {currentRun.status === "PROMOTED" && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            PROMOTED (Active)
          </span>
        )}
        {currentRun.status === "REJECTED" && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            REJECTED
          </span>
        )}
      </div>

      {/* Policy Compliance Checklist */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-800">
          Deterministic Policy Compliance Checklist
        </h4>
        <div className="space-y-1.5">
          {eligibility?.criteria_results.map((crit, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                crit.passed
                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50/50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {crit.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <div>
                  <span className="font-semibold">{crit.criterion_name}:</span>{" "}
                  <span className="text-[11px] opacity-80">{crit.expected_rule}</span>
                </div>
              </div>
              <span className="font-mono font-semibold text-[11px]">
                {String(crit.observed_value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Failure Warning */}
      {!isEligible && eligibility && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-900">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Promotion Blocked by Governance Guard
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {eligibility.failure_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Operator Actions */}
      {!isAlreadyDecided ? (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Operator Review Notes (Audit Trail)
            </label>
            <textarea
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="e.g. Validated with operator review; robust performance on held-out trials..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePromote}
              disabled={isProcessing || !isEligible}
              className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isProcessing ? "Promoting..." : "Approve & Promote to Active Research"}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isProcessing}
              className="py-2.5 px-4 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <XSquare className="w-4 h-4" />
              Reject Candidate
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800">
            Decision Audit Record ({currentRun.promotion_decision?.decision})
          </div>
          <div className="text-[11px] text-slate-500">
            Action: {currentRun.promotion_decision?.operator_action} at{" "}
            {currentRun.promotion_decision?.timestamp}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Reject Candidate Model
            </h3>
            <p className="text-xs text-slate-500">
              Provide an audit rationale for rejecting this candidate model. The base incumbent model will remain active.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Unacceptable regression on left imagery class..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isProcessing}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
