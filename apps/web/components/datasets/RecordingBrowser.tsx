"use client";

import React, { useState } from "react";
import { DatasetRecording, DatasetSubject } from "@neuromove/contracts";
import { Button } from "@/components/ui/Button";
import {
  PlayCircle,
  DownloadCloud,
  CheckCircle2,
  Search,
} from "lucide-react";
import Link from "next/link";

interface RecordingBrowserProps {
  recordings: DatasetRecording[];
  subjects: DatasetSubject[];
  selectedSubject: string;
  onSubjectChange: (subId: string) => void;
  onDownloadRun: (subjectId: string, runId: string) => void;
  isDownloading?: boolean;
}

export function RecordingBrowser({
  recordings,
  subjects,
  selectedSubject,
  onSubjectChange,
  onDownloadRun,
  isDownloading = false,
}: RecordingBrowserProps) {
  const [selectedTask, setSelectedTask] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = recordings.filter((rec) => {
    const matchesTask =
      selectedTask === "ALL" ||
      rec.task === selectedTask ||
      rec.normalized_task_label.toLowerCase().includes(selectedTask.toLowerCase());
    const matchesSearch =
      searchQuery === "" ||
      rec.recording_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.normalized_task_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.run_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTask && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filtering & Controls Bar */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Selector */}
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-bold text-slate-500 uppercase">
              Subject:
            </span>
            <select
              value={selectedSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_id} ({s.source_subject_id} - 14 Runs)
                </option>
              ))}
            </select>
          </div>

          {/* Task Filter */}
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-bold text-slate-500 uppercase">
              Task:
            </span>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-sans font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Tasks (14 Experimental Runs)</option>
              <option value="motor_imagery_fists">Motor Imagery: Left/Right Fist</option>
              <option value="motor_imagery_feet">Motor Imagery: Fists/Feet</option>
              <option value="motor_execution_fists">Motor Execution: Left/Right Fist</option>
              <option value="motor_execution_feet">Motor Execution: Fists/Feet</option>
              <option value="baseline_eyes_open">Baseline (Eyes Open)</option>
              <option value="baseline_eyes_closed">Baseline (Eyes Closed)</option>
            </select>
          </div>
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search run or recording..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Recordings Table */}
      <div className="border border-slate-200 bg-white rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-3xs font-mono font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Experimental Task Protocol</th>
                <th className="py-3 px-4">Sample Rate</th>
                <th className="py-3 px-4">Channels</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Event Markers</th>
                <th className="py-3 px-4">Cache Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No recordings match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr
                    key={rec.recording_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {rec.run_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div className="truncate max-w-xs" title={rec.normalized_task_label}>
                        {rec.normalized_task_label}
                      </div>
                      <div className="text-3xs font-mono text-slate-400 truncate">
                        {rec.file_reference}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {rec.sample_rate_hz} Hz
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {rec.channel_count} ch (10-10)
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {rec.duration_seconds.toFixed(1)}s
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-2xs font-mono bg-slate-100 text-slate-700 font-medium">
                        {rec.event_count} markers
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {rec.cache_status === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-mono font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-2xs font-mono font-semibold text-slate-500">
                          <DownloadCloud className="w-3 h-3" />
                          CACHED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadRun(rec.subject_id, rec.run_id)}
                          disabled={isDownloading}
                          className="text-2xs"
                        >
                          Sync
                        </Button>
                        <Link
                          href={`/eeg?dataset=${rec.dataset_id}&recording=${rec.recording_id}&mode=REPLAY`}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<PlayCircle className="w-3.5 h-3.5" />}
                            className="text-2xs"
                          >
                            Open in EEG Lab
                          </Button>
                        </Link>
                      </div>
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
