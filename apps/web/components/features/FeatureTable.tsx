"use client";

import React, { useState } from "react";
import { FeatureSet } from "@neuromove/contracts";

interface FeatureTableProps {
  featureSet: FeatureSet | null;
  dataRows: Record<string, any>[];
  onDownloadCsv: () => void;
}

export function FeatureTable({
  featureSet,
  dataRows,
  onDownloadCsv,
}: FeatureTableProps) {
  const [filterLabel, setFilterLabel] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  if (!featureSet || dataRows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400">
        No feature matrix generated yet. Configure and extract features to view the matrix.
      </div>
    );
  }

  const featureNames = featureSet.feature_names;
  const labels = Object.keys(featureSet.label_distribution);

  const filteredRows = dataRows.filter((row) => {
    if (filterLabel !== "ALL" && row.label !== filterLabel) return false;
    if (searchTerm) {
      const matchSearch =
        row.trial_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.subject_id.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
    }
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Extracted Feature Matrix
            </h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
              {featureSet.row_count} trials x {featureSet.feature_count} features
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-band integrated spectral power and sensorimotor lateralization values
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Label Filter */}
          <select
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Classes ({dataRows.length})</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l} ({featureSet.label_distribution[l]})
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search trial/subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Feature Table Grid */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-3 py-2.5 whitespace-nowrap">Trial ID</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Subject</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Class Label</th>
              {featureNames.map((feat) => (
                <th key={feat} className="px-3 py-2.5 whitespace-nowrap font-mono">
                  {feat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
              >
                <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {row.trial_id}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {row.subject_id}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                    {row.label}
                  </span>
                </td>
                {featureNames.map((feat) => (
                  <td
                    key={feat}
                    className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap"
                  >
                    {typeof row[feat] === "number" ? row[feat].toFixed(4) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
