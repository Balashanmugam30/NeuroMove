"use client";

import React, { useState } from "react";
import {
  ConfidenceHistoryRecord,
  TemporalConfirmationEvent,
} from "@neuromove/contracts";
import {
  History,
  Search,
  Filter,
  Download,
} from "lucide-react";


interface ConfidenceHistoryTableProps {
  history: ConfidenceHistoryRecord[];
  events?: TemporalConfirmationEvent[];
  isLoading?: boolean;
}

export function ConfidenceHistoryTable({
  history,
  events = [],
  isLoading = false,
}: ConfidenceHistoryTableProps) {
  const [activeTab, setActiveTab] = useState<"decisions" | "events">("decisions");
  const [searchTerm, setSearchTerm] = useState("");
  const [bandFilter, setBandFilter] = useState<string>("ALL");

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.predicted_class.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.decision_reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model_version_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBand = bandFilter === "ALL" || item.band === bandFilter;
    return matchesSearch && matchesBand;
  });

  const getBandBadge = (band: string) => {
    switch (band) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            MEDIUM
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {band}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            CONFIRMED
          </span>
        );
      case "TRACKING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            TRACKING
          </span>
        );
      case "COOLDOWN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            COOLDOWN
          </span>
        );
      case "RESET":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            RESET
          </span>
        );
      default:
        return <span className="text-slate-500 text-[11px]">{status}</span>;
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `confidence_history_${Date.now()}.json`);
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
            <h3 className="text-sm font-semibold text-slate-900">Telemetry Provenance & Historical Decisions</h3>
            <p className="text-xs text-slate-500">Full audit log of confidence calculations and temporal transitions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab("decisions")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === "decisions" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              Evaluations ({history.length})
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === "events" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              Temporal Events ({events.length})
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
            placeholder="Search class, model version, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        {activeTab === "decisions" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Bands</option>
              <option value="HIGH">High Confidence (&ge;75%)</option>
              <option value="MEDIUM">Medium Confidence (55-75%)</option>
              <option value="LOW">Low Confidence (40-55%)</option>
              <option value="UNKNOWN">Unknown / Gated</option>
            </select>
          </div>
        )}
      </div>

      {/* Table Content */}
      {activeTab === "decisions" ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Model</th>
                <th className="px-3 py-2.5">Prediction</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Band</th>
                <th className="px-3 py-2.5">Eligibility</th>
                <th className="px-3 py-2.5">Temporal</th>
                <th className="px-3 py-2.5">Decision Text</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    No confidence history records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((row) => (
                  <tr key={row.history_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700 font-medium">
                      {row.model_version_id}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                      {row.predicted_class}
                    </td>
                    <td className="px-3 py-2 font-bold text-blue-600">
                      {(row.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2">{getBandBadge(row.band)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-medium ${row.eligibility === "VALID" ? "text-emerald-700" : "text-rose-700"}`}>
                        {row.eligibility}
                      </span>
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(row.temporal_status)}</td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] max-w-xs truncate" title={row.decision_reason}>
                      {row.decision_reason}
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
                <th className="px-3 py-2.5">Seq</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Event Type</th>
                <th className="px-3 py-2.5">Candidate</th>
                <th className="px-3 py-2.5">Windows</th>
                <th className="px-3 py-2.5">Duration</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    No temporal confirmation transitions logged yet.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">#{evt.sequence_number}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{evt.event_type}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{evt.candidate_class || "—"}</td>
                    <td className="px-3 py-2 font-mono text-blue-600">{evt.consecutive_windows}</td>
                    <td className="px-3 py-2 font-mono text-teal-600">{Math.round(evt.accumulated_duration_ms)} ms</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{(evt.confidence_score * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] max-w-xs truncate" title={evt.decision_reason}>
                      {evt.decision_reason}
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
