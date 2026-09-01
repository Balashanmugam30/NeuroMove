"use client";

import React, { useState } from "react";
import { ConfusionMatrixData } from "@neuromove/contracts";
import { Grid } from "lucide-react";

interface ConfusionMatrixViewerProps {
  data: ConfusionMatrixData;
  title?: string;
}

export const ConfusionMatrixViewer: React.FC<ConfusionMatrixViewerProps> = ({
  data,
  title = "Aggregate Confusion Matrix",
}) => {
  const [showNormalized, setShowNormalized] = useState(false);

  const labels = data.labels;
  const matrix = showNormalized ? data.normalized_matrix : data.matrix;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setShowNormalized(false)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              !showNormalized
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Raw Counts
          </button>
          <button
            type="button"
            onClick={() => setShowNormalized(true)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              showNormalized
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Normalized (%)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto py-2">
        <div className="inline-block min-w-full align-middle">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Predicted Label &rarr;
            </span>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider -rotate-90">
                True Label &rarr;
              </span>

              <table className="border-collapse text-xs font-mono">
                <thead>
                  <tr>
                    <th className="p-2 border border-slate-100 bg-slate-50 text-slate-400"></th>
                    {labels.map((lbl) => (
                      <th
                        key={lbl}
                        className="p-2.5 border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-center"
                      >
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labels.map((trueLbl, rowIdx) => (
                    <tr key={trueLbl}>
                      <th className="p-2.5 border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-right whitespace-nowrap">
                        {trueLbl}
                      </th>
                      {labels.map((predLbl, colIdx) => {
                        const val = matrix[rowIdx]?.[colIdx] ?? 0;
                        const isDiagonal = rowIdx === colIdx;
                        const displayVal = showNormalized
                          ? `${(val * 100).toFixed(1)}%`
                          : val;

                        return (
                          <td
                            key={predLbl}
                            className={`p-3 border border-slate-200 text-center font-bold transition-all ${
                              isDiagonal
                                ? "bg-blue-50/80 text-blue-700 font-extrabold"
                                : val > 0
                                ? "bg-amber-50/40 text-slate-600"
                                : "bg-white text-slate-400"
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
