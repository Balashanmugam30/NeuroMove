"use client";

import React from "react";
import { DatasetDefinition, DatasetCacheStatus } from "@neuromove/contracts";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  DownloadCloud,
  FileCheck,
  ShieldAlert,
  ExternalLink,
  BookOpen,
  Layers,
  Users,
} from "lucide-react";

interface DatasetCatalogCardProps {
  dataset: DatasetDefinition;
  onVerify?: () => void;
  onViewManifest?: () => void;
  onViewQuality?: () => void;
  isVerifying?: boolean;
}

export function DatasetCatalogCard({
  dataset,
  onVerify,
  onViewManifest,
  onViewQuality,
  isVerifying = false,
}: DatasetCatalogCardProps) {
  const getCacheBadge = (status: DatasetCacheStatus) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Cache
          </span>
        );
      case "DOWNLOADED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
            <DownloadCloud className="w-3.5 h-3.5 text-blue-600" />
            Downloaded
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Partial Cache
          </span>
        );
      case "CORRUPT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-mono font-bold bg-red-50 text-red-700 border border-red-200 uppercase">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            Checksum Mismatch
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            Remote Indexed
          </span>
        );
    }
  };

  return (
    <SectionCard
      title={dataset.name}
      description={dataset.description}
      badge={getCacheBadge(dataset.cache_status)}
      className="border-slate-200 shadow-xs"
    >
      <div className="space-y-4">
        {/* Core Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-400 text-3xs font-mono uppercase">Provider & Source</div>
            <div className="font-semibold text-slate-800 mt-0.5 truncate">{dataset.provider}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-400 text-3xs font-mono uppercase">Modality & Channels</div>
            <div className="font-semibold text-slate-800 mt-0.5">{dataset.modality}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-400 text-3xs font-mono uppercase">Cohort Scope</div>
            <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>{dataset.subjects_count} Subjects (14 Runs ea.)</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-400 text-3xs font-mono uppercase">License / Terms</div>
            <div className="font-semibold text-slate-800 mt-0.5 truncate" title={dataset.license}>
              {dataset.license}
            </div>
          </div>
        </div>

        {/* Task Protocol Tags */}
        <div className="space-y-1.5">
          <div className="text-3xs font-mono font-bold uppercase text-slate-400">
            Experimental Motor Imagery & Execution Tasks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dataset.tasks.map((task) => (
              <span
                key={task}
                className="px-2 py-0.5 rounded text-2xs font-mono bg-blue-50 text-blue-700 border border-blue-100"
              >
                {task}
              </span>
            ))}
          </div>
        </div>

        {/* Citations and Provenance Link */}
        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-2xs text-slate-600 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">
              <strong>Official Reference:</strong> {dataset.official_reference}
            </span>
          </div>
          <a
            href={dataset.source_reference}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 shrink-0"
          >
            <span>PhysioNet Documentation</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Action Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onVerify}
              disabled={isVerifying}
              icon={<FileCheck className="w-3.5 h-3.5 text-blue-600" />}
            >
              {isVerifying ? "Verifying SHA-256..." : "Verify Cache Checksums"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewManifest}
              icon={<Layers className="w-3.5 h-3.5" />}
            >
              Manifest JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewQuality}
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            >
              Ingestion Quality
            </Button>
          </div>

          <span className="text-3xs font-mono text-slate-400">
            Schema: {dataset.schema_version} | Loader: {dataset.default_loader}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
