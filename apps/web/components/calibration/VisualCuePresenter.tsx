"use client";

import React, { useEffect } from "react";
import type { CalibrationSession, CalibrationTrial } from "@neuromove/contracts";
import { ArrowLeft, ArrowRight, Crosshair, Pause, Play, Square, Circle, Sparkles, Brain } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface VisualCuePresenterProps {
  session: CalibrationSession | null;
  trials: CalibrationTrial[];
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onAdvanceStep?: () => void;
  isSimulating?: boolean;
}

export function VisualCuePresenter({
  session,
  trials,
  onPause,
  onResume,
  onAbort,
  onAdvanceStep,
  isSimulating = false,
}: VisualCuePresenterProps) {
  const activeIndex = session?.active_trial_index ?? 0;
  const currentTrial = trials[activeIndex] || null;

  const isRunning = session?.status === "IN_PROGRESS";
  const isPaused = session?.status === "PAUSED";
  const isComplete = session?.status === "QUALITY_REVIEW" || session?.status === "READY" || session?.status === "ABORTED";

  // Class counters
  const completedTrials = trials.filter((t) => t.status === "COMPLETED");
  const leftDone = completedTrials.filter((t) => t.target_label === "LEFT_IMAGERY").length;
  const rightDone = completedTrials.filter((t) => t.target_label === "RIGHT_IMAGERY").length;
  const totalLeft = trials.filter((t) => t.target_label === "LEFT_IMAGERY").length || 10;
  const totalRight = trials.filter((t) => t.target_label === "RIGHT_IMAGERY").length || 10;

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && session) {
        e.preventDefault();
        if (isRunning) onPause();
        else if (isPaused) onResume();
      } else if (e.code === "Escape" && isRunning) {
        e.preventDefault();
        onAbort();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isPaused, session, onPause, onResume, onAbort]);

  // Render cue visual depending on current trial phase
  const renderCueSymbol = () => {
    if (!session || session.status === "PLANNED") {
      return (
        <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Circle className="w-20 h-20 text-slate-300 stroke-1" />
          <div className="text-sm font-semibold text-slate-600">Calibration Standby</div>
          <div className="text-xs text-slate-400">Press Start to arm Graz visual cue sequence</div>
        </div>
      );
    }

    if (isComplete) {
      return (
        <div className="flex flex-col items-center justify-center space-y-3 text-emerald-600">
          <Sparkles className="w-20 h-20 stroke-1 text-emerald-500 animate-pulse" />
          <div className="text-lg font-bold text-slate-900">Calibration Protocol Complete</div>
          <div className="text-xs text-slate-500">All trials recorded. Review Quality Control & Personalize Model.</div>
        </div>
      );
    }

    if (isPaused) {
      return (
        <div className="flex flex-col items-center justify-center space-y-3 text-amber-600">
          <Pause className="w-16 h-16 stroke-1 text-amber-500" />
          <div className="text-sm font-bold text-amber-900">Protocol Paused</div>
          <div className="text-xs text-slate-500">Press Resume or Spacebar to continue</div>
        </div>
      );
    }

    // Active Trial Cues
    const targetLabel = currentTrial?.target_label;


    if (session.active_phase === "REST") {
      return (
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-24 h-24 rounded-full border-4 border-slate-200 flex items-center justify-center bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rest</span>
          </div>
          <div className="text-xs text-slate-400 font-medium">Blink and relax muscles</div>
        </div>
      );
    }

    if (session.active_phase === "FIXATION") {
      return (
        <div className="flex flex-col items-center justify-center space-y-3">
          <Crosshair className="w-24 h-24 text-slate-800 stroke-[1.5]" />
          <div className="text-xs font-semibold text-slate-600">Fixate gaze on crosshair</div>
        </div>
      );
    }

    if (targetLabel === "LEFT_IMAGERY") {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-32 h-32 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-lg transform transition-transform">
            <ArrowLeft className="w-20 h-20 stroke-[2.5]" />
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-blue-900 uppercase tracking-wide">Left Hand Imagery</div>
            <div className="text-xs text-blue-700">Imagine kinesthetic left hand squeeze</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-32 h-32 rounded-3xl bg-teal-600 text-white flex items-center justify-center shadow-lg transform transition-transform">
            <ArrowRight className="w-20 h-20 stroke-[2.5]" />
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-teal-900 uppercase tracking-wide">Right Hand Imagery</div>
            <div className="text-xs text-teal-700">Imagine kinesthetic right hand squeeze</div>
          </div>
        </div>
      );
    }
  };

  const totalTrials = trials.length || 20;
  const progressPct = totalTrials > 0 ? (activeIndex / totalTrials) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Graz Visual Cue Presentation</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-3xs font-semibold uppercase tracking-wider ${
                isRunning
                  ? "bg-blue-100 text-blue-800"
                  : isPaused
                  ? "bg-amber-100 text-amber-800"
                  : isComplete
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {session?.status || "STANDBY"}
            </span>
          </div>
          <p className="text-xs text-slate-500">Kinesthetic motor imagery trial presentation</p>
        </div>

        {/* Class Progress Meters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span className="font-semibold text-slate-700">Left:</span>
            <span className="font-mono font-bold text-slate-900">{leftDone}/{totalLeft}</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
            <span className="font-semibold text-slate-700">Right:</span>
            <span className="font-mono font-bold text-slate-900">{rightDone}/{totalRight}</span>
          </div>
        </div>
      </div>

      {/* Main Cue Viewport (Focused & High Contrast) */}
      <div className="relative h-80 flex items-center justify-center bg-slate-50 border-b border-slate-200 select-none">
        {renderCueSymbol()}

        {/* Floating Trial Number Badge */}
        {isRunning && (
          <div className="absolute top-4 left-6 px-3 py-1 rounded-xl bg-white/90 backdrop-blur-xs border border-slate-200 text-xs font-mono font-bold text-slate-700 shadow-2xs">
            Trial {activeIndex + 1} of {totalTrials}
          </div>
        )}

        {/* Keyboard Controls Callout */}
        <div className="absolute bottom-3 right-6 text-3xs text-slate-400 font-mono hidden sm:block">
          Space: Pause/Resume • Esc: Abort
        </div>
      </div>

      {/* Overall Progress & Action Controls */}
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Protocol Progress</span>
            <span className="font-mono text-slate-900">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-slate-400" />
            <span>Target: <strong>Requested Imagery Class</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <>
                {onAdvanceStep && isSimulating && (
                  <Button variant="secondary" size="sm" onClick={onAdvanceStep}>
                    Step Trial (Sim)
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onPause} icon={<Pause className="w-3.5 h-3.5" />}>
                  Pause Session
                </Button>
                <Button variant="destructive" size="sm" onClick={onAbort} icon={<Square className="w-3.5 h-3.5" />}>
                  Abort
                </Button>

              </>
            )}

            {isPaused && (
              <>
                <Button variant="primary" size="sm" onClick={onResume} icon={<Play className="w-3.5 h-3.5" />}>
                  Resume Session
                </Button>
                <Button variant="destructive" size="sm" onClick={onAbort} icon={<Square className="w-3.5 h-3.5" />}>
                  Abort
                </Button>

              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
