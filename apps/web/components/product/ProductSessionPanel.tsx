"use client";

import React from "react";
import { History, RotateCcw } from "lucide-react";
import { ProductSession } from "@neuromove/contracts";

interface ProductSessionPanelProps {
  session: ProductSession | null;
  onResetSession: () => void;
  loading?: boolean;
}

export function ProductSessionPanel({
  session,
  onResetSession,
  loading = false,
}: ProductSessionPanelProps) {
  if (!session) return null;

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs font-sans space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-900 tracking-tight">
            Active Product Session Details
          </h4>
        </div>
        <button
          type="button"
          onClick={onResetSession}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Session</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-mono">
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Session ID:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {session.session_id}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Subject Pseudonym:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {session.subject_id}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Model Version:</span>
          <span className="font-semibold text-indigo-700 truncate block">
            {session.model_version}
          </span>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-slate-400 block mb-0.5">Confidence Policy:</span>
          <span className="font-semibold text-slate-800 truncate block">
            {session.confidence_policy}
          </span>
        </div>
      </div>
    </div>
  );
}
