"use client";

import React, { useState } from "react";
import {
  IntentRecord,
  IntentStateTransition,
} from "@neuromove/contracts";
import { History, Search, Filter, Download } from "lucide-react";


interface IntentHistoryTableProps {
  transitions: IntentStateTransition[];
  records: IntentRecord[];
}

export function IntentHistoryTable({
  transitions,
  records,
}: IntentHistoryTableProps) {

  const [activeTab, setActiveTab] = useState<"transitions" | "records">("transitions");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("ALL");

  const filteredTransitions = transitions.filter((t) => {
    const matchesSearch =
      (t.intent_class || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.details || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = stateFilter === "ALL" || t.next_state === stateFilter;
    return matchesSearch && matchesState;
  });

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.intent_class.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.intent_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = stateFilter === "ALL" || r.current_state === stateFilter;
    return matchesSearch && matchesState;
  });

  const handleExportJSON = () => {
    const dataToExport = activeTab === "transitions" ? transitions : records;
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `intent_${activeTab}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Intent History & Transition Audit Log</h3>
            <p className="text-xs text-slate-500">Immutable trace of finite state machine transitions and created entities</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab("transitions")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === "transitions" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              Transitions ({transitions.length})
            </button>
            <button
              onClick={() => setActiveTab("records")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === "records" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              Intent Records ({records.length})
            </button>
          </div>

          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search class, reason, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All States</option>
            <option value="NO_INTENT">NO_INTENT</option>
            <option value="CANDIDATE">CANDIDATE</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="INTERRUPTED">INTERRUPTED</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {activeTab === "transitions" ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Seq</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Intent Class</th>
                <th className="px-3 py-2.5">Transition</th>
                <th className="px-3 py-2.5">Trigger</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTransitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    No transition records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredTransitions.map((t) => (
                  <tr key={t.transition_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">#{t.sequence_number}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{t.intent_class || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                      <span className="text-slate-500">{t.previous_state}</span>
                      <span className="text-slate-300 mx-1">&rarr;</span>
                      <span className="text-blue-700 font-bold">{t.next_state}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{t.trigger}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-teal-700">{t.reason}</td>
                    <td className="px-3 py-2 font-mono text-slate-900">
                      {t.confidence_score !== null && t.confidence_score !== undefined
                        ? `${(t.confidence_score * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Intent ID</th>
                <th className="px-3 py-2.5">Class</th>
                <th className="px-3 py-2.5">State</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Model</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    No intent records logged yet.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.intent_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700 truncate max-w-[120px]" title={r.intent_id}>
                      {r.intent_id}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{r.intent_class}</td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-blue-700">{r.current_state}</td>
                    <td className="px-3 py-2 font-mono text-slate-900">{(r.confidence_score * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.model_version_id}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(r.updated_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
