import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Recycle,
  Scale,
  Layers,
  ArrowRight,
  Database,
  Building2,
  Flame,
  Package,
  History,
  Trash2,
  Upload,
  Sparkles,
  Calendar,
  X,
} from 'lucide-react';
import {
  ReconciliationRow,
  SkuRegrindVsRejectionItem,
  UnitType,
  ProductionSection,
  DailyReportSnapshot,
} from '../types';

interface DashboardViewProps {
  reconciliationRows: ReconciliationRow[];
  skuRegrindRows: SkuRegrindVsRejectionItem[];
  selectedUnit: UnitType;
  selectedSection?: ProductionSection;
  selectedDate: string;
  loadedArchiveSnapshot?: DailyReportSnapshot | null;
  savedReports?: DailyReportSnapshot[];
  onNavigateToTab: (tab: 'reconciliation' | 'regrind') => void;
  onOpenImport: () => void;
  onOpenHistory?: () => void;
  onUnloadSnapshot?: () => void;
  onDeleteSnapshot?: (id: string) => void;
  onLoadSnapshot?: (report: DailyReportSnapshot) => void;
  onLoadSampleData?: () => void;
  onClearAllData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reconciliationRows,
  skuRegrindRows,
  selectedUnit,
  selectedSection = 'All',
  selectedDate,
  loadedArchiveSnapshot,
  savedReports = [],
  onNavigateToTab,
  onOpenImport,
  onOpenHistory,
  onUnloadSnapshot,
  onDeleteSnapshot,
  onLoadSnapshot,
  onLoadSampleData,
  onClearAllData,
}) => {
  // Filter by Unit
  const filteredRec = reconciliationRows.filter(
    r => selectedUnit === 'All' || r.unit === selectedUnit
  );

  // Filter regrind items by Section if set
  const filteredSkuRows = skuRegrindRows.filter(
    s => selectedSection === 'All' || !s.section || s.section === selectedSection
  );

  const hasData = filteredRec.length > 0 || filteredSkuRows.length > 0;

  // Compute Reconciliation KPIs
  const totalTallyOutward = filteredRec.reduce((sum, r) => sum + r.tallyOutwardKg, 0);
  const totalProductionRm = filteredRec.reduce((sum, r) => sum + r.productionRmConsumptionKg, 0);
  const totalAppConsumed = filteredRec.reduce((sum, r) => sum + r.appConsumedKg, 0);
  const totalOpeningStock = filteredRec.reduce((sum, r) => sum + r.openingStockKg, 0);
  const totalClosingStock = filteredRec.reduce((sum, r) => sum + r.closingStockKg, 0);
  const totalMixingReturn = filteredRec.reduce((sum, r) => sum + r.mixingReturnKg, 0);
  const totalVariance = filteredRec.reduce((sum, r) => sum + r.varianceKg, 0);

  const matchCount = filteredRec.filter(r => r.status === 'Match').length;
  const mismatchCount = filteredRec.filter(r => r.status === 'Mismatch').length;
  const onlyTallyCount = filteredRec.filter(r => r.status === 'Only in Tally').length;
  const onlyAppCount = filteredRec.filter(r => r.status === 'Only in App').length;

  // Compute Regrind vs Rejection KPIs
  const totalRejection = filteredSkuRows.reduce((sum, s) => sum + s.productionRejectionKg, 0);
  const totalRegrindProduced = filteredSkuRows.reduce((sum, s) => sum + s.regrindProducedKg, 0);
  const totalRegrindConsumed = filteredSkuRows.reduce((sum, s) => sum + s.periodConsumedKg, 0);
  const totalCrushedDelta = totalRegrindProduced - totalRejection;
  const overallRecoveryRate = totalRejection > 0 ? (totalRegrindProduced / totalRejection) * 100 : 0;

  // Category breakdown
  const categoryData = ['Raw Material (RM)', 'Masterbatch (MB)', 'Filler MB (FMB)'].map(cat => {
    const items = filteredRec.filter(r => r.category === cat);
    const tally = items.reduce((s, r) => s + r.tallyOutwardKg, 0);
    const prod = items.reduce((s, r) => s + r.productionRmConsumptionKg, 0);
    return { category: cat, tally, prod };
  });

  // Top 6 SKUs for Regrind vs Rejection
  const topSkus = filteredSkuRows.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Archive Active Notice Banner if currently viewing a loaded snapshot */}
      {loadedArchiveSnapshot && (
        <div className="rounded-2xl bg-cyan-950/80 border border-cyan-500/50 p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-cyan-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-full">
                  Archive Snapshot Active
                </span>
                <span className="font-bold text-white text-sm">
                  {loadedArchiveSnapshot.title}
                </span>
              </div>
              <p className="text-xs text-cyan-300/80 mt-0.5">
                Dashboard is displaying historical snapshot from {loadedArchiveSnapshot.date} ({loadedArchiveSnapshot.unit}). Saved: {new Date(loadedArchiveSnapshot.savedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onUnloadSnapshot && (
              <button
                onClick={onUnloadSnapshot}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              >
                Exit Snapshot
              </button>
            )}
            {onDeleteSnapshot && (
              <button
                onClick={() => onDeleteSnapshot(loadedArchiveSnapshot.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                title="Delete this archive and clear dashboard"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Archive</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Welcome & Shift Context Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-900/60 text-cyan-300 border border-cyan-700/60">
                {selectedUnit === 'All' ? 'Consolidated (Unit-1 & Unit-2)' : selectedUnit}
              </span>
              <span className="text-xs text-slate-400">Date: {selectedDate}</span>
              {selectedSection !== 'All' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/60">
                  {selectedSection} Section
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1.5 tracking-tight">
              Operational Reconciliation & Regrind Performance
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Monitoring store outwards (Tally Prime ERP) against mixing floor issues, production RM consumption,
              and recycle crushing recovery.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigateToTab('reconciliation')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition flex items-center gap-2"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Input Floor Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenImport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import CSV</span>
            </button>
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>Archives ({savedReports.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tally Outward */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tally Store Outwards</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {totalTallyOutward.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-400">Kg</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>From Store Godown Summary</span>
          </div>
        </div>

        {/* KPI 2: Production Consumption */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Production RM Consumption</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {totalProductionRm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-400">Kg</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Mixing Return: {totalMixingReturn.toFixed(1)} Kg</span>
          </div>
        </div>

        {/* KPI 3: Reconciled Discrepancy */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Discrepancy (Variance)</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                Math.abs(totalVariance) < 5
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                Math.abs(totalVariance) < 5 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {totalVariance > 0 ? `+${totalVariance.toFixed(1)}` : totalVariance.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-400">Kg</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400 font-medium">{matchCount} Matched</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-medium">{mismatchCount} Variance</span>
          </div>
        </div>

        {/* KPI 4: Regrind Produced vs Rejection */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Regrind Produced (Crushed)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Recycle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {totalRegrindProduced.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-slate-400">Kg</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Rejection: {totalRejection.toFixed(0)} Kg ({overallRecoveryRate.toFixed(0)}% recovery)</span>
          </div>
        </div>
      </div>

      {/* Floor Stock Highlights Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/50 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
              Mixing Floor Opening Stock
            </div>
            <div className="text-lg font-bold text-cyan-300">
              {totalOpeningStock.toFixed(2)} <span className="text-xs text-slate-400 font-normal">Kg</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
              Total Available in Mixing
            </div>
            <div className="text-lg font-bold text-blue-300">
              {(totalOpeningStock + totalTallyOutward).toFixed(2)} <span className="text-xs text-slate-400 font-normal">Kg</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
              Mixing Floor Closing Stock
            </div>
            <div className="text-lg font-bold text-emerald-300">
              {totalClosingStock.toFixed(2)} <span className="text-xs text-slate-400 font-normal">Kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Slate Empty State if No Data */}
      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/70 text-slate-400 border border-slate-700 flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">
              No Data Records for {selectedUnit === 'All' ? 'Consolidated Units' : selectedUnit} on {selectedDate}
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              All demo data is currently cleared. You can import your daily production reports (Blow & Injection) and Tally store outward records, or load a historical archive.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenImport}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import Daily Files</span>
            </button>
            <button
              onClick={() => onNavigateToTab('reconciliation')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Go to Reconciliation Table
            </button>
            {onLoadSampleData && (
              <button
                onClick={onLoadSampleData}
                className="px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-slate-700/70 text-slate-300 text-xs transition flex items-center gap-1.5"
                title="Load 01-Oct sample demo data for preview or testing"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Sample Demo Data</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Visual Analytics Sections if Data Exists */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: SKU Wise Regrind Produced vs Rejection (Top Items) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Recycle className="w-4 h-4 text-emerald-400" />
                  SKU Regrind Produced vs Production Rejection
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Top SKUs by rejection & crushing activity
                </p>
              </div>
              <button
                onClick={() => onNavigateToTab('regrind')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
              >
                View Full Report <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5">
              {topSkus.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No SKU regrind records available for current selection.
                </div>
              ) : (
                topSkus.map(sku => {
                  const maxVal = Math.max(sku.regrindProducedKg, sku.productionRejectionKg, 1);
                  return (
                    <div key={sku.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-200 truncate max-w-[220px]" title={sku.skuName}>
                          {sku.skuName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300">
                            {sku.color}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${
                              sku.recoveryRatePercent >= 100
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            }`}
                          >
                            {sku.recoveryRatePercent.toFixed(0)}% crushed
                          </span>
                        </div>
                      </div>

                      {/* Dual Bar Comparison */}
                      <div className="space-y-1.5 pt-1">
                        {/* Regrind Produced Bar */}
                        <div>
                          <div className="flex justify-between text-[11px] text-emerald-300 mb-0.5">
                            <span>Regrind Produced (Crushed)</span>
                            <span className="font-mono font-medium">{sku.regrindProducedKg.toFixed(1)} Kg</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (sku.regrindProducedKg / maxVal) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Production Rejection Bar */}
                        <div>
                          <div className="flex justify-between text-[11px] text-amber-300 mb-0.5">
                            <span>Production Rejection</span>
                            <span className="font-mono font-medium">{sku.productionRejectionKg.toFixed(1)} Kg</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (sku.productionRejectionKg / maxVal) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chart 2: Category Breakdown & Reconciliation Status */}
          <div className="space-y-6">
            {/* Material Category Distribution */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-400" />
                    Material Category Outwards vs Consumption
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Raw Material, Masterbatch, and Filler comparison
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {categoryData.map(cat => {
                  const maxKg = Math.max(cat.tally, cat.prod, 1);
                  return (
                    <div key={cat.category} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-200">{cat.category}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Diff: {(cat.prod - cat.tally).toFixed(1)} Kg
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <div className="flex justify-between text-blue-300 mb-0.5">
                            <span>Tally Store:</span>
                            <span className="font-mono font-bold">{cat.tally.toFixed(1)} Kg</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, (cat.tally / maxKg) * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-cyan-300 mb-0.5">
                            <span>Prod Consumed:</span>
                            <span className="font-mono font-bold">{cat.prod.toFixed(1)} Kg</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${Math.min(100, (cat.prod / maxKg) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reconciliation Health Status Cards */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-3">Reconciliation Status Distribution</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl text-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-emerald-300">{matchCount}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Matched</div>
                </div>

                <div className="bg-amber-950/40 border border-amber-800/50 p-3 rounded-xl text-center">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-amber-300">{mismatchCount}</div>
                  <div className="text-[10px] text-amber-400 font-medium">Variance</div>
                </div>

                <div className="bg-purple-950/40 border border-purple-800/50 p-3 rounded-xl text-center">
                  <Database className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-purple-300">{onlyTallyCount}</div>
                  <div className="text-[10px] text-purple-400 font-medium">Store Outward Only</div>
                </div>

                <div className="bg-blue-950/40 border border-blue-800/50 p-3 rounded-xl text-center">
                  <Flame className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-blue-300">{onlyAppCount}</div>
                  <div className="text-[10px] text-blue-400 font-medium">App Consumed Only</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Archives Quick Access Section */}
      {savedReports.length > 0 && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Daily Reconciliation Archives ({savedReports.length})</h3>
                <p className="text-xs text-slate-400">
                  Quick load or delete daily saved reconciliation reports. Updates dashboard instantly.
                </p>
              </div>
            </div>
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Manage All Archives &rarr;
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedReports.map(rep => {
              const isLoaded = loadedArchiveSnapshot?.id === rep.id;

              return (
                <div
                  key={rep.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    isLoaded
                      ? 'bg-cyan-950/50 border-cyan-500/60 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate" title={rep.title}>
                        {rep.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 font-semibold">
                        {rep.unit}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>{rep.date}</span>
                      <span>•</span>
                      <span>{new Date(rep.savedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="text-slate-400">
                        Tally Outward: <strong className="text-white">{rep.kpis.totalTallyOutwardKg.toFixed(1)} Kg</strong>
                      </div>
                      <div className="text-slate-400">
                        Discrepancy: <strong className={Math.abs(rep.kpis.totalVarianceKg) < 5 ? 'text-emerald-400' : 'text-amber-400'}>
                          {rep.kpis.totalVarianceKg > 0 ? `+${rep.kpis.totalVarianceKg.toFixed(1)}` : rep.kpis.totalVarianceKg.toFixed(1)} Kg
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    {onLoadSnapshot && (
                      <button
                        onClick={() => onLoadSnapshot(rep)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          isLoaded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                        }`}
                      >
                        {isLoaded ? 'Active in Dashboard' : 'Load in Dashboard'}
                      </button>
                    )}

                    {onDeleteSnapshot && (
                      <button
                        onClick={() => onDeleteSnapshot(rep.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                        title="Delete this archive (will update dashboard immediately)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
