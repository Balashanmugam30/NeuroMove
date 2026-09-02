"use client";

import React, { useState } from "react";
import { ResearchArtifact } from "@neuromove/contracts";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";

interface ArtifactExportHubProps {
  experimentId: string;
  onExport: (artifactType: string) => Promise<ResearchArtifact>;
}

export function ArtifactExportHub({ experimentId, onExport }: ArtifactExportHubProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportedArtifacts, setExportedArtifacts] = useState<Record<string, ResearchArtifact>>({});

  const handleDownload = async (artType: string, defaultFilename: string) => {
    setDownloading(artType);
    try {
      const art = await onExport(artType);
      setExportedArtifacts((prev) => ({ ...prev, [artType]: art }));

      // Trigger browser download
      const blob = new Blob([art.content_json || ""], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = art.file_name || defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failed
    } finally {
      setDownloading(null);
    }
  };

  const exportTypes = [
    {
      type: "MANIFEST_JSON",
      name: "Sealed Manifest JSON",
      desc: "Deterministic SHA-256 hashed configuration parameters",
      ext: ".json",
      icon: FileJson,
    },
    {
      type: "RESULT_JSON",
      name: "Complete Results JSON",
      desc: "Full hierarchical experiment results and stage checksums",
      ext: ".json",
      icon: FileJson,
    },
    {
      type: "METRICS_CSV",
      name: "Classification Metrics CSV",
      desc: "Accuracy, F1, precision, recall, and calibration scores",
      ext: ".csv",
      icon: FileSpreadsheet,
    },
    {
      type: "LATENCY_CSV",
      name: "Latency Percentiles CSV",
      desc: "Stage-by-stage timing samples and percentiles",
      ext: ".csv",
      icon: FileSpreadsheet,
    },
    {
      type: "CONFUSION_MATRIX_JSON",
      name: "Confusion Matrix JSON",
      desc: "Class labels and raw confusion matrix counts",
      ext: ".json",
      icon: FileJson,
    },
    {
      type: "EXPERIMENT_SUMMARY_MD",
      name: "Scientific Summary Markdown",
      desc: "Publication-ready overview and non-actuation proofs",
      ext: ".md",
      icon: FileText,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Scientific Artifact Exports & Reports
          </h3>
          <p className="text-xs text-slate-400">
            Export checksummed audit artifacts in JSON, CSV, and Markdown formats
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exportTypes.map((item) => {
          const Icon = item.icon;
          const isCurrent = downloading === item.type;
          const art = exportedArtifacts[item.type];

          return (
            <div
              key={item.type}
              className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-slate-900 text-indigo-400 rounded border border-slate-800">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">{item.name}</h4>
                  <p className="text-3xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                {art ? (
                  <span className="text-3xs font-mono text-emerald-400 truncate max-w-[120px]" title={art.checksum}>
                    #{art.checksum.slice(0, 8)}
                  </span>
                ) : (
                  <span className="text-3xs font-mono text-slate-400">Ready</span>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(item.type, `${experimentId}_export${item.ext}`)}
                  disabled={isCurrent}
                  className="flex items-center gap-1 px-2.5 py-1 text-3xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition shadow-sm disabled:opacity-50"
                >
                  <Download className={`w-3 h-3 ${isCurrent ? "animate-bounce" : ""}`} />
                  {isCurrent ? "Exporting..." : "Download"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
