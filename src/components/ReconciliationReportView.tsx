import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Save,
  Layers,
  ArrowUpDown,
  Building2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ReconciliationRow,
  UnitType,
  MaterialCategory,
  ReconciliationStatus,
} from '../types';
import { exportReconciliationToCsv, copyTableToClipboardForGoogleSheets } from '../utils/exportUtils';

interface ReconciliationReportViewProps {
  rows: ReconciliationRow[];
  selectedUnit: UnitType;
  selectedDate: string;
  onUpdateStock: (
    unit: 'Unit-1' | 'Unit-2',
    materialName: string,
    opening: number,
    closing: number,
    notes?: string
  ) => void;
  onSaveReport: () => void;
}

export const ReconciliationReportView: React.FC<ReconciliationReportViewProps> = ({
  rows,
  selectedUnit,
  selectedDate,
  onUpdateStock,
  onSaveReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [copied, setCopied] = useState(false);
  const [sortField, setSortField] = useState<'materialName' | 'tallyOutwardKg' | 'varianceKg' | 'productionRmConsumptionKg'>('tallyOutwardKg');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter rows
  const filtered = rows.filter(r => {
    if (selectedUnit !== 'All' && r.unit !== selectedUnit) return false;
    if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        r.materialName.toLowerCase().includes(q) ||
        r.tallyRawName.toLowerCase().includes(q) ||
        r.appRawName.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Sort rows
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortField === 'materialName') {
      diff = a.materialName.localeCompare(b.materialName);
    } else {
      diff = (a[sortField] || 0) - (b[sortField] || 0);
    }
    return sortOrder === 'asc' ? diff : -diff;
  });

  // Column totals
  const totals = sorted.reduce(
    (acc, r) => {
      acc.opening += r.openingStockKg;
      acc.tally += r.tallyOutwardKg;
      acc.totalAvail += r.totalAvailableKg;
      acc.app += r.appConsumedKg;
      acc.prod += r.productionRmConsumptionKg;
      acc.return += r.mixingReturnKg;
      acc.closing += r.closingStockKg;
      acc.variance += r.varianceKg;
      acc.diff += r.differenceAppTallyKg;
      return acc;
    },
    { opening: 0, tally: 0, totalAvail: 0, app: 0, prod: 0, return: 0, closing: 0, variance: 0, diff: 0 }
  );

  const handleExportCsv = () => {
    exportReconciliationToCsv(sorted, selectedDate, selectedUnit);
  };

  const handleCopyForSheets = async () => {
    const headers = [
      'Unit',
      'Material Category',
      'Material Name',
      'Opening Stock in Mixing (Kg)',
      'Tally Outward (Kg)',
      'Total Available (Kg)',
      'Apps Mixing Consumed (Kg)',
      'Production RM Consumption (Kg)',
      'Mixing Return (Kg)',
      'Closing Stock in Mixing (Kg)',
      'Discrepancy Variance (Kg)',
      'App vs Tally Diff (Kg)',
      'Status',
      'Notes',
    ];
    const data = sorted.map(r => [
      r.unit,
      r.category,
      r.materialName,
      r.openingStockKg,
      r.tallyOutwardKg,
      r.totalAvailableKg,
      r.appConsumedKg,
      r.productionRmConsumptionKg,
      r.mixingReturnKg,
      r.closingStockKg,
      r.varianceKg,
      r.differenceAppTallyKg,
      r.status,
      r.notes || '',
    ]);

    const ok = await copyTableToClipboardForGoogleSheets(headers, data);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Tally Outwards vs Apps Mixing vs Production RM Consumption
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
              Interactive Floor Stock
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare Tally ERP store issues with mixing floor issues and production consumption. You can edit Opening & Closing mixing stock directly in the table.
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition"
            title="Download Reconciliation Report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onSaveReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition"
            title="Save daily report and sync to Google Sheet"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Report</span>
          </button>
        </div>
      </div>

      {/* Controls: Search, Category Filter, Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search material, grade, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3 h-3 text-slate-400 mr-1" />
            <span className="text-slate-400 text-[11px] hidden sm:inline">Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Categories</option>
              <option value="Raw Material (RM)" className="bg-slate-900">Raw Material (RM)</option>
              <option value="Masterbatch (MB)" className="bg-slate-900">Masterbatch (MB)</option>
              <option value="Filler MB (FMB)" className="bg-slate-900">Filler MB (FMB)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Statuses ({rows.length})</option>
              <option value="Match" className="bg-slate-900">Match Only</option>
              <option value="Mismatch" className="bg-slate-900">Mismatch / Variance</option>
              <option value="Only in Tally" className="bg-slate-900">Only in Tally (Store Issue)</option>
              <option value="Only in App" className="bg-slate-900">Only in App/Prod</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-cyan-400 font-bold">{sorted.length}</span> of {rows.length} materials
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-20 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 w-16">Unit</th>
                <th className="py-3 px-3 min-w-[200px]">
                  <button
                    onClick={() => toggleSort('materialName')}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    <span>Material Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right bg-blue-950/40 text-blue-300 font-semibold min-w-[105px]">
                  Opening Stock (Kg)
                </th>
                <th className="py-3 px-2 text-right min-w-[105px]">
                  <button
                    onClick={() => toggleSort('tallyOutwardKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Tally Outward</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[95px]">
                  Total Avail
                </th>
                <th className="py-3 px-2 text-right min-w-[100px]">
                  Apps Mixing
                </th>
                <th className="py-3 px-2 text-right min-w-[100px]">
                  <button
                    onClick={() => toggleSort('productionRmConsumptionKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Prod RM Cons.</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[85px]">
                  Return
                </th>
                <th className="py-3 px-2 text-right bg-emerald-950/40 text-emerald-300 font-semibold min-w-[105px]">
                  Closing Stock (Kg)
                </th>
                <th className="py-3 px-2 text-right font-bold min-w-[95px]">
                  <button
                    onClick={() => toggleSort('varianceKg')}
                    className="flex items-center justify-end gap-1 hover:text-white w-full text-right"
                  >
                    <span>Variance</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-slate-400 min-w-[85px]">
                  App - Tally
                </th>
                <th className="py-3 px-3 text-center min-w-[110px]">Status</th>
                <th className="py-3 px-3 min-w-[160px]">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    No reconciliation records found matching criteria.
                  </td>
                </tr>
              ) : (
                sorted.map(row => {
                  const isMatch = row.status === 'Match';
                  const isOnlyTally = row.status === 'Only in Tally';
                  const isOnlyApp = row.status === 'Only in App';
                  const isMismatch = row.status === 'Mismatch';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Unit */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                            row.unit === 'Unit-1'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                          }`}
                        >
                          {row.unit}
                        </span>
                      </td>

                      {/* Material Name & Category */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{row.materialName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="text-slate-400">{row.category}</span>
                          {row.tallyRawName && row.appRawName && row.tallyRawName !== row.appRawName && (
                            <span className="text-amber-400" title={`Tally: ${row.tallyRawName} | App: ${row.appRawName}`}>
                              • naming alias
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Opening Stock (Kg) - USER EDITABLE INPUT FIELD */}
                      <td className="py-2 px-2 text-right bg-blue-950/20">
                        <input
                          type="number"
                          step="any"
                          value={row.openingStockKg === 0 ? '' : row.openingStockKg}
                          placeholder="0.0"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            onUpdateStock(row.unit, row.materialName, val, row.closingStockKg, row.notes);
                          }}
                          className="w-20 px-2 py-1 text-right rounded-md bg-slate-950/90 border border-blue-900/60 text-blue-200 text-xs font-mono focus:border-blue-400 focus:bg-slate-900 transition"
                          title="Click to edit Opening Stock in Mixing"
                        />
                      </td>

                      {/* Tally Outward */}
                      <td className="py-2.5 px-2 text-right font-mono font-medium text-slate-200">
                        {row.tallyOutwardKg.toFixed(2)}
                      </td>

                      {/* Total Available (Opening + Tally) */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.totalAvailableKg.toFixed(2)}
                      </td>

                      {/* Apps Mixing Consumed */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                        {row.appConsumedKg.toFixed(2)}
                      </td>

                      {/* Production RM Consumption */}
                      <td className="py-2.5 px-2 text-right font-mono text-cyan-300 font-medium">
                        {row.productionRmConsumptionKg.toFixed(2)}
                      </td>

                      {/* Mixing Return */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.mixingReturnKg > 0 ? (
                          <span className="text-amber-400 font-medium">{row.mixingReturnKg.toFixed(2)}</span>
                        ) : (
                          '0.00'
                        )}
                      </td>

                      {/* Closing Stock (Kg) - USER EDITABLE INPUT FIELD */}
                      <td className="py-2 px-2 text-right bg-emerald-950/20">
                        <input
                          type="number"
                          step="any"
                          value={row.closingStockKg === 0 ? '' : row.closingStockKg}
                          placeholder="0.0"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            onUpdateStock(row.unit, row.materialName, row.openingStockKg, val, row.notes);
                          }}
                          className="w-20 px-2 py-1 text-right rounded-md bg-slate-950/90 border border-emerald-900/60 text-emerald-200 text-xs font-mono focus:border-emerald-400 focus:bg-slate-900 transition"
                          title="Click to edit Closing Stock in Mixing"
                        />
                      </td>

                      {/* Calculated Physical Variance */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold">
                        <span
                          className={
                            Math.abs(row.varianceKg) < 0.5
                              ? 'text-emerald-400'
                              : row.varianceKg > 0
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }
                        >
                          {row.varianceKg > 0 ? `+${row.varianceKg.toFixed(2)}` : row.varianceKg.toFixed(2)}
                        </span>
                      </td>

                      {/* App - Tally Diff */}
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-slate-400">
                        {row.differenceAppTallyKg > 0
                          ? `+${row.differenceAppTallyKg.toFixed(2)}`
                          : row.differenceAppTallyKg.toFixed(2)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isMatch
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : isOnlyTally
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : isOnlyApp
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      {/* Remarks Note Field */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          defaultValue={row.notes || ''}
                          placeholder="Add note / action..."
                          onBlur={e => {
                            if (e.target.value !== (row.notes || '')) {
                              onUpdateStock(
                                row.unit,
                                row.materialName,
                                row.openingStockKg,
                                row.closingStockKg,
                                e.target.value
                              );
                            }
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-hidden"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Sum Totals */}
            <tfoot className="bg-slate-950 text-white font-bold border-t-2 border-slate-700 text-xs">
              <tr>
                <td colSpan={2} className="py-3 px-3 text-right uppercase tracking-wider text-slate-400">
                  Total ({sorted.length} Items):
                </td>
                <td className="py-3 px-2 text-right font-mono text-blue-300 bg-blue-950/30">
                  {totals.opening.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-white">
                  {totals.tally.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-300">
                  {totals.totalAvail.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-300">
                  {totals.app.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-cyan-300">
                  {totals.prod.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-amber-400">
                  {totals.return.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-emerald-300 bg-emerald-950/30">
                  {totals.closing.toFixed(2)}
                </td>
                <td
                  className={`py-3 px-2 text-right font-mono text-sm ${
                    Math.abs(totals.variance) < 5 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {totals.variance > 0 ? `+${totals.variance.toFixed(2)}` : totals.variance.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-400">
                  {totals.diff > 0 ? `+${totals.diff.toFixed(2)}` : totals.diff.toFixed(2)}
                </td>
                <td colSpan={2} className="py-3 px-3 text-center text-[11px] text-slate-400 font-normal">
                  Units in Kilograms (Kg)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Reconciliation Guidance Card */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-200">Reconciliation & Floor Stock Formulas:</div>
          <p>
            <strong>Total Available:</strong> Opening Stock + Tally Outward from Store.
            &nbsp;•&nbsp;
            <strong>Variance (Discrepancy):</strong> (Opening Stock + Tally Outward - Mixing Return) - (Production RM Consumption + Closing Stock).
            &nbsp;•&nbsp;
            <strong>Difference (App - Tally):</strong> Apps Consumed - Tally Outward.
          </p>
          <p className="text-[11px] text-slate-500">
            Note: All edits to Opening and Closing mixing stock are saved locally per material and automatically included when clicking "Save Daily" or syncing to Google Sheet.
          </p>
        </div>
      </div>
    </div>
  );
};
