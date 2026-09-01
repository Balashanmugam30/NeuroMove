"use client";

import React from "react";
import { CSPPatternData } from "@neuromove/contracts";
import { SlidersHorizontal, Info } from "lucide-react";

interface CSPPatternViewerProps {
  patterns: CSPPatternData | null;
}

export const CSPPatternViewer: React.FC<CSPPatternViewerProps> = ({
  patterns,
}) => {
  if (!patterns || !patterns.patterns || patterns.patterns.length === 0) {
    return null;
  }

  const channels = patterns.channels;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            CSP Spatial Filter Patterns & Electrode Weights
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {patterns.n_components} Components &bull; {channels.length} Channels
        </span>
      </div>

      <div className="space-y-4">
        {patterns.patterns.map((compWeights, compIdx) => {
          const maxAbs = Math.max(...compWeights.map((w) => Math.abs(w)), 1e-6);

          return (
            <div
              key={compIdx}
              className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="font-mono text-blue-700">
                  CSP Component #{compIdx + 1}
                </span>
                {patterns.eigenvalues && patterns.eigenvalues[compIdx] !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">
                    &lambda; = {patterns.eigenvalues[compIdx].toFixed(4)}
                  </span>
                )}
              </div>

              {/* Electrode weight bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-1">
                {channels.map((ch, chIdx) => {
                  const weight = compWeights[chIdx] ?? 0;
                  const normWeight = weight / maxAbs;
                  const isPositive = weight >= 0;

                  return (
                    <div
                      key={ch}
                      className="flex flex-col items-center p-2 rounded-md bg-white border border-slate-200 text-center"
                    >
                      <span className="text-[10px] font-bold text-slate-700 font-mono">
                        {ch}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {weight.toFixed(3)}
                      </span>
                      {/* Weight visualization bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden flex">
                        <div
                          className={`h-full rounded-full ${
                            isPositive ? "bg-blue-600 ml-auto" : "bg-amber-500"
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(normWeight) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          Spatial patterns reflect source signal projection onto scalp electrodes during motor imagery.
        </span>
      </div>
    </div>
  );
};
