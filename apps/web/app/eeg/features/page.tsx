"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  EpochingPreview,
  EpochingRequest,
  EpochRecord,
  EpochSignalResponse,
  EpochSummary,
  FeatureExtractionRequest,
  FeatureSet,
  CovarianceSet,
} from "@neuromove/contracts";
import {
  previewEpoching,
  runEpoching,
  listEpochSets,
  fetchEpochRecords,
  fetchEpochSignal,
  fetchEpochManifest,
  extractFeatures,
  listFeatureSets,
  fetchFeatureData,
  fetchCovarianceSet,
  fetchFeatureManifest,
} from "@/lib/api-client";

import { EpochSegmentor } from "@/components/features/EpochSegmentor";
import { EpochVisualizer } from "@/components/features/EpochVisualizer";
import { FeatureTable } from "@/components/features/FeatureTable";
import { CovarianceViewer } from "@/components/features/CovarianceViewer";
import { ClassDistributionCard } from "@/components/features/ClassDistributionCard";

export default function FeaturesWorkspacePage() {
  const [epochSummary, setEpochSummary] = useState<EpochSummary | null>(null);
  const [epochRecords, setEpochRecords] = useState<EpochRecord[]>([]);
  const [featureSet, setFeatureSet] = useState<FeatureSet | null>(null);
  const [featureDataRows, setFeatureDataRows] = useState<Record<string, any>[]>([]);
  const [covarianceSet, setCovarianceSet] = useState<CovarianceSet | null>(null);
  const [isLoadingEpoching, setIsLoadingEpoching] = useState<boolean>(false);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<"features" | "covariance" | "manifest">("features");
  const [manifestJson, setManifestJson] = useState<string>("");

  // Load latest sets on initial mount
  useEffect(() => {
    async function loadInitial() {
      try {
        const epSets = await listEpochSets(1);
        if (epSets.length > 0) {
          const latestEp = epSets[0];
          setEpochSummary(latestEp);
          const recs = await fetchEpochRecords(latestEp.epoch_set_id);
          setEpochRecords(recs);
        }

        const featSets = await listFeatureSets(1);
        if (featSets.length > 0) {
          const latestFeat = featSets[0];
          setFeatureSet(latestFeat);
          const data = await fetchFeatureData(latestFeat.feature_set_id);
          setFeatureDataRows(data);
          const cov = await fetchCovarianceSet(latestFeat.feature_set_id);
          setCovarianceSet(cov);
        }
      } catch (err) {
        console.error("Failed to load initial epoch/feature data:", err);
      }
    }
    loadInitial();
  }, []);

  const handlePreviewEpoching = async (req: EpochingRequest): Promise<EpochingPreview | null> => {
    try {
      return await previewEpoching(req);
    } catch (err: any) {
      setStatusMessage(`Preview error: ${err.message}`);
      return null;
    }
  };

  const handleRunEpoching = async (req: EpochingRequest): Promise<void> => {
    setIsLoadingEpoching(true);
    setStatusMessage("Segmenting motor-imagery epochs...");
    try {
      const summary = await runEpoching(req);
      setEpochSummary(summary);
      const records = await fetchEpochRecords(summary.epoch_set_id);
      setEpochRecords(records);
      setStatusMessage(`Successfully extracted ${summary.valid_epochs} valid epochs.`);
    } catch (err: any) {
      setStatusMessage(`Epoching error: ${err.message}`);
    } finally {
      setIsLoadingEpoching(false);
    }
  };

  const handleFetchEpochSignal = useCallback(
    async (epochId: string): Promise<EpochSignalResponse | null> => {
      if (!epochSummary) return null;
      try {
        return await fetchEpochSignal(epochSummary.epoch_set_id, epochId);
      } catch (err) {
        console.error("Signal fetch error:", err);
        return null;
      }
    },
    [epochSummary]
  );

  const handleRunFeatureExtraction = async () => {
    if (!epochSummary) {
      setStatusMessage("Please run epoch segmentation first.");
      return;
    }
    setIsLoadingFeatures(true);
    setStatusMessage("Extracting spectral band powers and spatial covariance matrices...");
    try {
      const featReq: FeatureExtractionRequest = {
        epoch_set_id: epochSummary.epoch_set_id,
        config: {
          feature_version: "EEG_FEATURES_V1",
          channels: ["C3", "Cz", "C4"],
          bands: [
            { name: "mu", fmin_hz: 8.0, fmax_hz: 13.0 },
            { name: "beta", fmin_hz: 13.0, fmax_hz: 30.0 },
          ],
          power_type: "ALL",
          include_lateralization: true,
          lateralization_pairs: [["C3", "C4"]],
          epsilon: 1e-12,
          covariance_method: "NORMALIZED",
        },
      };

      const feat = await extractFeatures(featReq);
      setFeatureSet(feat);
      const data = await fetchFeatureData(feat.feature_set_id);
      setFeatureDataRows(data);
      const cov = await fetchCovarianceSet(feat.feature_set_id);
      setCovarianceSet(cov);
      setStatusMessage(`Successfully extracted ${feat.row_count} feature vectors (${feat.feature_count} features each).`);
    } catch (err: any) {
      setStatusMessage(`Feature extraction error: ${err.message}`);
    } finally {
      setIsLoadingFeatures(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!featureSet) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    window.open(`${apiUrl}/api/eeg/features/${featureSet.feature_set_id}/export/csv`, "_blank");
  };

  const handleViewManifest = async () => {
    if (featureSet) {
      const manifest = await fetchFeatureManifest(featureSet.feature_set_id);
      setManifestJson(JSON.stringify(manifest, null, 2));
    } else if (epochSummary) {
      const manifest = await fetchEpochManifest(epochSummary.epoch_set_id);
      setManifestJson(JSON.stringify(manifest, null, 2));
    }
    setSelectedTab("manifest");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Motor-Imagery Epoching & Feature Foundation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Research workspace for event normalization, trial segmentation, spectral features, and CSP representations
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Phase 10: EEG_FEATURES_V1
          </span>
          {featureSet && (
            <button
              type="button"
              onClick={handleViewManifest}
              className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition shadow-2xs"
            >
              View JSON Manifest
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {statusMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage("")}
            className="text-blue-600 hover:text-blue-800 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Section 1: Epoch Segmentation Config & Execution */}
      <EpochSegmentor
        onRunEpoching={handleRunEpoching}
        onPreviewEpoching={handlePreviewEpoching}
        isLoading={isLoadingEpoching}
      />

      {/* Section 2: Epoch Waveforms & Class Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EpochVisualizer
            records={epochRecords}
            onFetchSignal={handleFetchEpochSignal}
          />
        </div>
        <div>
          <ClassDistributionCard
            epochSummary={epochSummary}
            featureSet={featureSet}
          />
        </div>
      </div>

      {/* Section 3: Feature Extraction Action Panel */}
      <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/80 border border-blue-100 rounded-xl p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Multi-Band Spectral & Spatial Covariance Extraction
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Computes Mu (8–13 Hz) & Beta (13–30 Hz) absolute/relative/log powers, lateralization (C3-C4), and trace-normalized covariance matrices
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunFeatureExtraction}
          disabled={!epochSummary || isLoadingFeatures}
          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs disabled:opacity-50 transition whitespace-nowrap"
        >
          {isLoadingFeatures ? "Extracting Features..." : "Extract Features & Covariance"}
        </button>
      </div>

      {/* Section 4: Results Tabs (Feature Matrix vs Covariance vs Manifest) */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedTab("features")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              selectedTab === "features"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Feature Matrix Table
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("covariance")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              selectedTab === "covariance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Spatial Covariance Viewer
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("manifest")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              selectedTab === "manifest"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Provenance Manifest
          </button>
        </div>

        {selectedTab === "features" && (
          <FeatureTable
            featureSet={featureSet}
            dataRows={featureDataRows}
            onDownloadCsv={handleDownloadCsv}
          />
        )}

        {selectedTab === "covariance" && (
          <CovarianceViewer covarianceSet={covarianceSet} />
        )}

        {selectedTab === "manifest" && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-slate-900 font-mono text-xs overflow-x-auto shadow-inner max-h-[500px]">
            <pre>{manifestJson || "No manifest selected. Run epoching or feature extraction to view."}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
