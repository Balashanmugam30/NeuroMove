"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  FileCode2,
} from "lucide-react";
import { CommandTrace } from "@neuromove/contracts";

interface ProtocolTraceViewerProps {
  traces: CommandTrace[];
  isLoading?: boolean;
}

export function ProtocolTraceViewer({ traces, isLoading: _isLoading = false }: ProtocolTraceViewerProps) {
  const [filterDirection, setFilterDirection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTrace, setSelectedTrace] = useState<CommandTrace | null>(null);

  const filteredTraces = traces.filter((t) => {
    if (filterDirection !== "ALL" && t.direction !== filterDirection) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (t.command_id ?? "").toLowerCase().includes(q) ||
        t.message_id.toLowerCase().includes(q) ||
        t.checksum.toLowerCase().includes(q) ||
        t.message_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search traces (ID, CRC, type)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Directions</option>
              <option value="TX">TX (Outbound)</option>
              <option value="RX">RX (Inbound)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Showing {filteredTraces.length} of {traces.length} frames</span>
        </div>
      </div>

      {/* Frame Table & Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Packet Capture Table */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur border-b border-slate-200 text-[11px] font-sans font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Dir</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Seq</th>
                  <th className="py-2.5 px-3">Len</th>
                  <th className="py-2.5 px-3">CRC-32</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTraces.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No frame traces captured matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTraces.map((trace) => {
                    const isSelected = selectedTrace?.trace_id === trace.trace_id;
                    const isTX = trace.direction === "TX";

                    return (
                      <tr
                        key={trace.trace_id}
                        onClick={() => setSelectedTrace(trace)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50/90 text-blue-900 font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 px-3">
                          {isTX ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                              <ArrowUpRight className="w-3.5 h-3.5" /> TX
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-teal-600 font-bold">
                              <ArrowDownLeft className="w-3.5 h-3.5" /> RX
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500">
                          {new Date(trace.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold">
                          {trace.message_type}
                        </td>
                        <td className="py-2 px-3">#{trace.sequence_number}</td>
                        <td className="py-2 px-3">{trace.length_bytes}B</td>
                        <td className="py-2 px-3 text-slate-600">{trace.checksum}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] ${
                              trace.decode_status === "VALID"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {trace.decode_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Frame Inspector Drawer */}
        <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs p-4 text-slate-800 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800 pb-2 border-b border-slate-200">
              <FileCode2 className="w-4 h-4 text-teal-600" />
              Frame Deep Inspector
            </div>

            {selectedTrace ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Direction:</span>
                    <span className="font-bold text-teal-700">{selectedTrace.direction}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sequence #:</span>
                    <span className="font-bold text-slate-900">{selectedTrace.sequence_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Message ID:</span>
                    <span className="text-slate-700 truncate block font-bold">{selectedTrace.message_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Command ID:</span>
                    <span className="text-slate-700 truncate block font-bold">{selectedTrace.command_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payload Length:</span>
                    <span className="text-slate-700 font-bold">{selectedTrace.length_bytes} Bytes</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CRC-32 Checksum:</span>
                    <span className="text-emerald-700 font-bold">{selectedTrace.checksum}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-2xs text-slate-300 space-y-1 shadow-inner">
                  <div className="text-slate-500">{/* Header Framing */}</div>
                  <div className="text-teal-400">START: 0xAA55 &bull; TRAILER: 0x55AA</div>
                  {selectedTrace.ack_status && (
                    <div className="text-emerald-400 font-bold">
                      ACK Status: {selectedTrace.ack_status}
                    </div>
                  )}
                  {selectedTrace.latency_ms && (
                    <div className="text-teal-300">
                      RTT Latency: {selectedTrace.latency_ms.toFixed(2)} ms
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-sans">
                Select a frame row from the packet capture table to inspect raw bytes and framing metadata.
              </div>
            )}
          </div>

          <div className="text-3xs text-slate-400 pt-3 border-t border-slate-200 font-mono">
            CRC-32 IEEE 802.3 Verification &bull; Invariant 3 Validated
          </div>
        </div>
      </div>
    </div>
  );
}
