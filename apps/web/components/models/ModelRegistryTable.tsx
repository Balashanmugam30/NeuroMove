"use client";

import React from "react";
import { ModelSummary } from "@neuromove/contracts";
import { Database, Download, FileCode, CheckCircle2 } from "lucide-react";


interface ModelRegistryTableProps {
  models: ModelSummary[];
  onSelectModel: (modelId: string) => void;
  selectedModelId?: string;
}

export const ModelRegistryTable: React.FC<ModelRegistryTableProps> = ({
  models,
  onSelectModel,
  selectedModelId,
}) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  if (!models || models.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
        <Database className="w-8 h-8 text-slate-300 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-700">
          No Models Registered Yet
        </h4>
        <p className="text-xs text-slate-400">
          Execute a cross-validated benchmark above to persist and register classical BCI decoders.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-0">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Registered Classical Decoders
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {models.length} Models on Disk
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <th className="p-3.5 pl-5">Model ID / Task</th>
              <th className="p-3.5">Algorithm</th>
              <th className="p-3.5">Protocol</th>
              <th className="p-3.5 text-right">Balanced Acc</th>
              <th className="p-3.5 text-right">F1 Score</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 pr-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {models.map((m) => {
              const isSelected = m.model_id === selectedModelId;
              const balPct = (m.balanced_accuracy_mean * 100).toFixed(1);
              const f1Pct = (m.f1_mean * 100).toFixed(1);

              return (
                <tr
                  key={m.model_id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isSelected ? "bg-blue-50/40" : ""
                  }`}
                >
                  <td className="p-3.5 pl-5">
                    <div className="font-mono font-bold text-slate-900">
                      {m.model_id}
                    </div>
                    <div className="text-[11px] text-slate-500">{m.task_id}</div>
                  </td>

                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                      {m.classifier_type} ({m.n_components} CSP)
                    </span>
                  </td>

                  <td className="p-3.5 font-mono text-[11px] text-slate-600">
                    {m.evaluation_protocol}
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold text-blue-700">
                    {balPct}%
                  </td>

                  <td className="p-3.5 text-right font-mono text-teal-700 font-semibold">
                    {f1Pct}%
                  </td>

                  <td className="p-3.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {m.status}
                    </span>
                  </td>

                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectModel(m.model_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                      >
                        <FileCode className="w-3 h-3 text-blue-600" />
                        <span>Manifest</span>
                      </button>

                      <a
                        href={`${API_BASE_URL}/api/models/classical/models/${m.model_id}/export/csv`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                        title="Download CSV metrics"
                      >
                        <Download className="w-3 h-3 text-slate-500" />
                        <span>CSV</span>
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
