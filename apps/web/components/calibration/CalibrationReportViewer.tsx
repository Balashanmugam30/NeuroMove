"use client";

import React, { useState } from "react";
import { CalibrationReport } from "@neuromove/contracts";
import { FileText, Copy, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";


interface CalibrationReportViewerProps {
  report: CalibrationReport | null;
}

export function CalibrationReportViewer({ report }: CalibrationReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"structured" | "markdown">("structured");

  if (!report) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 shadow-xs">
        Calibration report will be compiled once session trials are finalized.
      </div>
    );
  }

  const markdownContent = `# NeuroMove Calibration Report & Manifest
**Report ID**: \`${report.report_id}\`
**Subject ID**: \`${report.subject_id}\`
**Calibration ID**: \`${report.calibration_id}\`
**Source Mode**: \`${report.source_mode}\`
**Created At**: \`${report.created_at}\`

## Quality Control Summary
- **Total Recorded Trials**: ${report.quality_summary.total_trials}
- **Valid Trials**: ${report.quality_summary.valid_trials} (${(report.quality_summary.valid_ratio * 100).toFixed(1)}%)
- **Rejected Trials**: ${report.quality_summary.rejected_trials} (${(report.quality_summary.rejection_ratio * 100).toFixed(1)}%)
- **Data Sufficiency**: ${report.quality_summary.is_sufficient ? "PASS" : "FAIL"}

## Evaluation Partitioning
- **Training Trials**: ${report.split_summary.train_trials}
- **Held-Out Trials**: ${report.split_summary.heldout_trials}
- **Partitioning Strategy**: \`${report.split_summary.strategy}\`

## Known Research Limitations
${report.known_limitations.map((l) => `- ${l}`).join("\n")}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Calibration Audit Manifest</h3>
            <span className="font-mono text-3xs text-slate-400">{report.report_id}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab("structured")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                activeTab === "structured" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Structured View
            </button>
            <button
              onClick={() => setActiveTab("markdown")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                activeTab === "markdown" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Markdown Manifest
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={handleCopy} icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="p-5">
        {activeTab === "structured" ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-3xs text-slate-400 uppercase font-semibold">Subject Identifier</span>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{report.subject_id}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-3xs text-slate-400 uppercase font-semibold">Valid Trial Ratio</span>
                <div className="font-mono font-bold text-emerald-700 mt-0.5">
                  {report.quality_summary.valid_trials} / {report.quality_summary.total_trials} ({(report.quality_summary.valid_ratio * 100).toFixed(1)}%)
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-3xs text-slate-400 uppercase font-semibold">Data Partitioning</span>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {report.split_summary.train_trials} Train / {report.split_summary.heldout_trials} Held-Out
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" /> Research & Clinical Scope Disclaimers
              </div>
              <ul className="text-2xs text-slate-600 space-y-1 list-disc list-inside">
                {report.known_limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-2xs overflow-x-auto max-h-96 leading-relaxed">
            {markdownContent}
          </pre>
        )}
      </div>
    </div>
  );
}
