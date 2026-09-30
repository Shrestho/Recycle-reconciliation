import React, { useState } from 'react';
import {
  Recycle,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  AlertTriangle,
  Factory,
  Layers,
} from 'lucide-react';
import { SkuRegrindVsRejectionItem, UnitType } from '../types';
import { exportSkuRegrindToCsv, copyTableToClipboardForGoogleSheets } from '../utils/exportUtils';

interface RegrindReportViewProps {
  items: SkuRegrindVsRejectionItem[];
  selectedUnit: UnitType;
  selectedDate: string;
}

export const RegrindReportView: React.FC<RegrindReportViewProps> = ({
  items,
  selectedUnit,
  selectedDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [copied, setCopied] = useState(false);
  const [sortField, setSortField] = useState<'skuName' | 'regrindProducedKg' | 'productionRejectionKg' | 'crushedDeltaKg' | 'recoveryRatePercent'>('regrindProducedKg');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Extract unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(items.map(i => i.recycleSource))).filter(Boolean);

  // Filter items
  const filtered = items.filter(item => {
    // Unit filter (check if item has balance in selected unit)
    if (selectedUnit === 'Unit-1' && item.balanceU1Kg === 0 && item.regrindProducedKg === 0) {
      // Keep if actively produced or has balance
      if (item.balanceU2Kg > 0 && item.balanceU1Kg === 0) return false;
    }
    if (selectedUnit === 'Unit-2' && item.balanceU2Kg === 0 && item.regrindProducedKg === 0) {
      if (item.balanceU1Kg > 0 && item.balanceU2Kg === 0) return false;
    }

    if (sourceFilter !== 'All' && item.recycleSource !== sourceFilter) return false;

    if (statusFilter === 'CrushedFull') {
      if (item.regrindProducedKg < item.productionRejectionKg) return false;
    } else if (statusFilter === 'Backlog') {
      if (item.regrindProducedKg >= item.productionRejectionKg) return false;
    } else if (statusFilter === 'Reused') {
      if (item.periodConsumedKg <= 0) return false;
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        item.skuName.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.recycleSource.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortField === 'skuName') {
      diff = a.skuName.localeCompare(b.skuName);
    } else {
      diff = (a[sortField] || 0) - (b[sortField] || 0);
    }
    return sortOrder === 'asc' ? diff : -diff;
  });

  // Summary Totals
  const totals = sorted.reduce(
    (acc, i) => {
      acc.produced += i.regrindProducedKg;
      acc.rejection += i.productionRejectionKg;
      acc.delta += i.crushedDeltaKg;
      acc.opening += i.openingBalanceKg;
      acc.consumed += i.periodConsumedKg;
      acc.closing += i.closingBalanceKg;
      acc.u1 += i.balanceU1Kg;
      acc.u2 += i.balanceU2Kg;
      return acc;
    },
    { produced: 0, rejection: 0, delta: 0, opening: 0, consumed: 0, closing: 0, u1: 0, u2: 0 }
  );

  const overallRecovery = totals.rejection > 0 ? (totals.produced / totals.rejection) * 100 : 0;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCsv = () => {
    exportSkuRegrindToCsv(sorted, selectedDate);
  };

  const handleCopyForSheets = async () => {
    const headers = [
      'SKU Name',
      'Color',
      'Recycle Source',
      'Regrind Produced (Crushed Kg)',
      'Production Rejection (Kg)',
      'Crushed Delta (Kg)',
      'Recovery Rate %',
      'Opening Balance (Kg)',
      'Period Consumed in Mixing (Kg)',
      'Closing Balance (Kg)',
      'Balance Unit-1 (Kg)',
      'Balance Unit-2 (Kg)',
    ];
    const data = sorted.map(i => [
      i.skuName,
      i.color,
      i.recycleSource,
      i.regrindProducedKg,
      i.productionRejectionKg,
      i.crushedDeltaKg,
      i.recoveryRatePercent + '%',
      i.openingBalanceKg,
      i.periodConsumedKg,
      i.closingBalanceKg,
      i.balanceU1Kg,
      i.balanceU2Kg,
    ]);

    const ok = await copyTableToClipboardForGoogleSheets(headers, data);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              SKU Wise Regrind Produced (Kg) vs Production Rejection (Kg)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              Recycle & Crushing Section
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Tracks rejections received from production lines against regrind crushed, reuse in mixing batches, and warehouse balance across Unit-1 & Unit-2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyForSheets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            title="Copy formatted table for pasting into Google Sheets / Excel"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied TSV!' : 'Copy for Sheet'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition"
            title="Export SKU Wise Regrind Report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Production Rejection</span>
          <div className="text-lg font-bold text-amber-300 mt-0.5">
            {totals.rejection.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-slate-500">From daily production run</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Regrind Produced</span>
          <div className="text-lg font-bold text-emerald-300 mt-0.5">
            {totals.produced.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-medium">
            {overallRecovery.toFixed(1)}% recovery rate
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Consumed in Mixing</span>
          <div className="text-lg font-bold text-cyan-300 mt-0.5">
            {totals.consumed.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-slate-500">Reused for new production</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <span className="text-[11px] text-slate-400 font-medium">Regrind Closing Stock</span>
          <div className="text-lg font-bold text-purple-300 mt-0.5">
            {totals.closing.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400">
            U1: {totals.u1.toFixed(0)} Kg | U2: {totals.u2.toFixed(0)} Kg
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search SKU / Color */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU name, color..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Recycle Source Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3 h-3 text-slate-400 mr-1" />
            <span className="text-slate-400 text-[11px] hidden sm:inline">Source:</span>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Sources</option>
              {uniqueSources.map(s => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Items ({items.length})</option>
              <option value="CrushedFull" className="bg-slate-900">Crushed ≥ Rejection (Cleared)</option>
              <option value="Backlog" className="bg-slate-900">Uncrushed Rejection Backlog</option>
              <option value="Reused" className="bg-slate-900">Active Reuse in Mixing</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-emerald-400 font-bold">{sorted.length}</span> SKUs
        </div>
      </div>

      {/* Main SKU Regrind vs Rejection Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-20 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 min-w-[200px]">
                  <button
                    onClick={() => toggleSort('skuName')}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    <span>SKU Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 min-w-[80px]">Color</th>
                <th className="py-3 px-2 min-w-[85px]">Source</th>
                <th className="py-3 px-2 text-right bg-emerald-950/40 text-emerald-300 font-semibold min-w-[110px]">
                  <button
                    onClick={() => toggleSort('regrindProducedKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Regrind Produced</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right bg-amber-950/40 text-amber-300 font-semibold min-w-[110px]">
                  <button
                    onClick={() => toggleSort('productionRejectionKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Prod. Rejection</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right font-bold min-w-[100px]">
                  <button
                    onClick={() => toggleSort('crushedDeltaKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Net Delta (Kg)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-center min-w-[100px]">
                  <button
                    onClick={() => toggleSort('recoveryRatePercent')}
                    className="flex items-center justify-center gap-1 hover:text-white w-full text-center"
                  >
                    <span>Recovery %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[95px]">Opening Bal</th>
                <th className="py-3 px-2 text-right text-cyan-300 min-w-[100px]">Mixing Reused</th>
                <th className="py-3 px-2 text-right font-medium text-purple-300 min-w-[95px]">Closing Bal</th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[85px]">U-1 Bal</th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[85px]">U-2 Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    No SKU regrind records found.
                  </td>
                </tr>
              ) : (
                sorted.map(row => {
                  const isHighRecovery = row.recoveryRatePercent >= 100;
                  const hasBacklog = row.productionRejectionKg > row.regrindProducedKg;

                  return (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      {/* SKU Name */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{row.skuName}</div>
                      </td>

                      {/* Color */}
                      <td className="py-2.5 px-2">
                        <span className="text-[11px] text-slate-300 font-medium">
                          {row.color || 'Standard'}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400">
                          {row.recycleSource}
                        </span>
                      </td>

                      {/* Regrind Produced (Crushed) */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-300 bg-emerald-950/15">
                        {row.regrindProducedKg.toFixed(2)}
                      </td>

                      {/* Production Rejection */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-300 bg-amber-950/15">
                        {row.productionRejectionKg.toFixed(2)}
                      </td>

                      {/* Crushed Delta (Kg) */}
                      <td className="py-2.5 px-2 text-right font-mono font-medium">
                        <span
                          className={
                            row.crushedDeltaKg > 0
                              ? 'text-emerald-400'
                              : row.crushedDeltaKg === 0
                              ? 'text-slate-400'
                              : 'text-rose-400'
                          }
                        >
                          {row.crushedDeltaKg > 0 ? `+${row.crushedDeltaKg.toFixed(2)}` : row.crushedDeltaKg.toFixed(2)}
                        </span>
                      </td>

                      {/* Recovery Rate % */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.productionRejectionKg === 0 && row.regrindProducedKg === 0
                              ? 'bg-slate-800 text-slate-400'
                              : isHighRecovery
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {row.recoveryRatePercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Opening Balance */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.openingBalanceKg.toFixed(1)}
                      </td>

                      {/* Mixing Consumed */}
                      <td className="py-2.5 px-2 text-right font-mono font-medium text-cyan-300">
                        {row.periodConsumedKg.toFixed(1)}
                      </td>

                      {/* Closing Balance */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-purple-300">
                        {row.closingBalanceKg.toFixed(1)}
                      </td>

                      {/* Balance Unit-1 */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.balanceU1Kg.toFixed(1)}
                      </td>

                      {/* Balance Unit-2 */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.balanceU2Kg.toFixed(1)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Summary Footer */}
            <tfoot className="bg-slate-950 text-white font-bold border-t-2 border-slate-700 text-xs">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider text-slate-400">
                  Total ({sorted.length} SKUs):
                </td>
                <td className="py-3 px-2 text-right font-mono text-emerald-300 bg-emerald-950/30">
                  {totals.produced.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-amber-300 bg-amber-950/30">
                  {totals.rejection.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-white">
                  {totals.delta > 0 ? `+${totals.delta.toFixed(2)}` : totals.delta.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-center font-mono text-emerald-300">
                  {overallRecovery.toFixed(1)}%
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-400">
                  {totals.opening.toFixed(1)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-cyan-300">
                  {totals.consumed.toFixed(1)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-purple-300">
                  {totals.closing.toFixed(1)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-400">
                  {totals.u1.toFixed(1)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-400">
                  {totals.u2.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
