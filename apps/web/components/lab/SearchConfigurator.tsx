import React from "react";
import { SearchConfig, SearchType, ModelFamily } from "@neuromove/contracts";
import { Sliders, Sparkles } from "lucide-react";


interface SearchConfiguratorProps {
  modelFamily: ModelFamily;
  config: SearchConfig;
  onChange: (newConfig: SearchConfig) => void;
  disabled?: boolean;
}

export function SearchConfigurator({
  modelFamily,
  config,
  onChange,
  disabled = false,
}: SearchConfiguratorProps) {
  const handleTypeChange = (type: SearchType) => {
    let defaultGrid: Record<string, unknown[]> = {};
    if (type !== "NONE") {
      if (modelFamily === "SVM_LINEAR") {
        defaultGrid = { c_param: [0.01, 0.1, 1.0, 10.0] };
      } else if (modelFamily === "SVM_RBF") {
        defaultGrid = { c_param: [0.1, 1.0, 10.0], gamma: ["scale", "auto"] };
      } else if (modelFamily === "LDA") {
        defaultGrid = { solver: ["svd", "lsqr"] };
      } else if (modelFamily === "RANDOM_FOREST") {
        defaultGrid = { n_estimators: [25, 50, 100], max_depth: [3, 5, 8] };
      } else if (modelFamily === "LOGISTIC_REGRESSION") {
        defaultGrid = { c_param: [0.01, 0.1, 1.0, 10.0] };
      }
    }

    onChange({
      ...config,
      search_type: type,
      param_grid: defaultGrid,
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Inner CV Hyperparameter Search
          </h4>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          Leakage-Safe Inner CV
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["NONE", "GRID", "RANDOM"] as SearchType[]).map((type) => {
          const isSelected = config.search_type === type;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => handleTypeChange(type)}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-white border-blue-600 ring-2 ring-blue-100 shadow-sm"
                  : "bg-white/60 border-slate-200 hover:border-slate-300 text-slate-600"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-slate-800">
                  {type === "NONE" ? "Fixed Baseline" : type === "GRID" ? "Grid Search" : "Random Search"}
                </span>
                {isSelected && <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {type === "NONE"
                  ? "Use default fixed parameters with no inner CV."
                  : type === "GRID"
                  ? "Exhaustive exploration within outer train fold."
                  : "Sampled parameter subspace search."}
              </p>
            </button>
          );
        })}
      </div>

      {config.search_type !== "NONE" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Inner CV Splits
            </label>
            <input
              type="number"
              min={2}
              max={10}
              disabled={disabled}
              value={config.inner_cv_splits}
              onChange={(e) =>
                onChange({
                  ...config,
                  inner_cv_splits: Math.max(2, parseInt(e.target.value) || 2),
                })
              }
              className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Number of internal validation folds on outer training data only.
            </p>
          </div>

          {config.search_type === "RANDOM" && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Max Iterations (n_iter)
              </label>
              <input
                type="number"
                min={2}
                max={50}
                disabled={disabled}
                value={config.n_iter}
                onChange={(e) =>
                  onChange({
                    ...config,
                    n_iter: Math.max(1, parseInt(e.target.value) || 5),
                  })
                }
                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Number of candidate parameter combinations to sample.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
