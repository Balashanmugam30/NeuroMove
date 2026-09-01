"use client";

import React from "react";
import { ClassificationTask } from "@neuromove/contracts";
import { Activity, CheckCircle2 } from "lucide-react";

interface TaskSelectorProps {
  tasks: ClassificationTask[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  disabled?: boolean;
}

export const TaskSelector: React.FC<TaskSelectorProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          1. Classification Task
        </label>
        <span className="text-xs text-slate-400">Supervised Motor Imagery</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map((task) => {
          const isSelected = task.task_id === selectedTaskId;
          return (
            <div
              key={task.task_id}
              onClick={() => !disabled && onSelectTask(task.task_id)}
              className={`relative flex flex-col p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-blue-50/50 border-blue-500 ring-1 ring-blue-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                      {task.task_name}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      {task.task_id}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
              </div>

              <p className="text-xs text-slate-600 mb-3 flex-1">
                {task.description}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mr-1">
                  Classes:
                </span>
                {task.class_labels.map((lbl) => (
                  <span
                    key={lbl}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60"
                  >
                    {lbl}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
