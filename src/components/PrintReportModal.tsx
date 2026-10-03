import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { ReconciliationRow, SkuRegrindVsRejectionItem, UnitType } from '../types';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationRows: ReconciliationRow[];
  skuRegrindRows: SkuRegrindVsRejectionItem[];
  selectedUnit: UnitType;
  selectedDate: string;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  reconciliationRows,
  skuRegrindRows,
  selectedUnit,
  selectedDate,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const filteredRec = reconciliationRows.filter(
    r => selectedUnit === 'All' || r.unit === selectedUnit
  );

  const totalTally = filteredRec.reduce((s, r) => s + r.tallyOutwardKg, 0);
  const totalOpening = filteredRec.reduce((s, r) => s + r.openingStockKg, 0);
  const totalApp = filteredRec.reduce((s, r) => s + r.appConsumedKg, 0);
  const totalProd = filteredRec.reduce((s, r) => s + r.productionRmConsumptionKg, 0);
  const totalReturn = filteredRec.reduce((s, r) => s + r.mixingReturnKg, 0);
  const totalClosing = filteredRec.reduce((s, r) => s + r.closingStockKg, 0);
  const totalVariance = filteredRec.reduce((s, r) => s + r.varianceKg, 0);

  const totalProduced = skuRegrindRows.reduce((s, r) => s + r.regrindProducedKg, 0);
  const totalRejection = skuRegrindRows.reduce((s, r) => s + r.productionRejectionKg, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Actions bar (hidden during print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 text-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-sm">Printable Daily Executive Report</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container (Styled cleanly for print / paper) */}
        <div className="p-8 overflow-y-auto bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible text-[11px] leading-tight">
          {/* Company Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                  ASTECH LIMITED
                </h1>
                <p className="text-xs text-slate-600">
                  B-19/20, BSCIC Industrial Estate, Sagorika Road, Chittagong-4219
                </p>
                <p className="text-xs text-slate-600">E-Mail: info@astechbd.com</p>
              </div>
              <div className="text-right">
                <div className="inline-block bg-slate-100 px-3 py-1 rounded border border-slate-300 font-bold text-xs uppercase">
                  Daily Reconciliation Report
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800">
                  Date: <span className="font-mono">{selectedDate}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  Scope: <span className="font-mono">{selectedUnit === 'All' ? 'Unit-1 & Unit-2' : selectedUnit}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Executive KPI Summary Box */}
          <div className="grid grid-cols-5 gap-2 border border-slate-300 rounded p-2.5 mb-5 bg-slate-50 text-center">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Opening Mixing Stock</span>
              <div className="text-sm font-bold font-mono text-slate-900">{totalOpening.toFixed(1)} Kg</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Tally Store Outwards</span>
              <div className="text-sm font-bold font-mono text-slate-900">{totalTally.toFixed(1)} Kg</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Production RM Cons.</span>
              <div className="text-sm font-bold font-mono text-slate-900">{totalProd.toFixed(1)} Kg</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Closing Mixing Stock</span>
              <div className="text-sm font-bold font-mono text-slate-900">{totalClosing.toFixed(1)} Kg</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Net Variance</span>
              <div className="text-sm font-bold font-mono text-slate-900">
                {totalVariance > 0 ? `+${totalVariance.toFixed(1)}` : totalVariance.toFixed(1)} Kg
              </div>
            </div>
          </div>

          {/* Table 1: Tally Reconciliation */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-400 pb-1 mb-2">
              1. Tally Outwards vs Mixing vs Production RM Consumption (Kg)
            </h2>
            <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
              <thead className="bg-slate-100 font-bold text-slate-800">
                <tr>
                  <th className="border border-slate-300 p-1 w-10">Unit</th>
                  <th className="border border-slate-300 p-1">Material Name</th>
                  <th className="border border-slate-300 p-1 text-right">Opening</th>
                  <th className="border border-slate-300 p-1 text-right">Tally Out</th>
                  <th className="border border-slate-300 p-1 text-right">Total Avail</th>
                  <th className="border border-slate-300 p-1 text-right">Apps Cons.</th>
                  <th className="border border-slate-300 p-1 text-right">Prod RM</th>
                  <th className="border border-slate-300 p-1 text-right">Return</th>
                  <th className="border border-slate-300 p-1 text-right">Closing</th>
                  <th className="border border-slate-300 p-1 text-right font-bold">Variance</th>
                  <th className="border border-slate-300 p-1 text-center">Status</th>
                  <th className="border border-slate-300 p-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRec.map(r => (
                  <tr key={r.id} className="even:bg-slate-50">
                    <td className="border border-slate-300 p-1 font-bold">{r.unit}</td>
                    <td className="border border-slate-300 p-1 font-medium">{r.materialName}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.openingStockKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.tallyOutwardKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.totalAvailableKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.appConsumedKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.productionRmConsumptionKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.mixingReturnKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{r.closingStockKg.toFixed(2)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-bold">
                      {r.varianceKg > 0 ? `+${r.varianceKg.toFixed(2)}` : r.varianceKg.toFixed(2)}
                    </td>
                    <td className="border border-slate-300 p-1 text-center font-bold text-[9px]">{r.status}</td>
                    <td className="border border-slate-300 p-1 text-slate-600">{r.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-400">
                <tr>
                  <td colSpan={2} className="border border-slate-300 p-1 text-right">TOTAL:</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalOpening.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalTally.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{(totalOpening + totalTally).toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalApp.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalProd.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalReturn.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalClosing.toFixed(2)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalVariance.toFixed(2)}</td>
                  <td colSpan={2} className="border border-slate-300 p-1"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Table 2: SKU Wise Regrind Produced vs Production Rejection */}
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-400 pb-1 mb-2">
              2. SKU Wise Regrind Produced (Kg) vs Production Rejection (Kg)
            </h2>
            <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
              <thead className="bg-slate-100 font-bold text-slate-800">
                <tr>
                  <th className="border border-slate-300 p-1">SKU Name</th>
                  <th className="border border-slate-300 p-1">Color</th>
                  <th className="border border-slate-300 p-1 text-right">Regrind Produced</th>
                  <th className="border border-slate-300 p-1 text-right">Prod. Rejection</th>
                  <th className="border border-slate-300 p-1 text-right font-bold">Net Delta</th>
                  <th className="border border-slate-300 p-1 text-center">Recovery %</th>
                  <th className="border border-slate-300 p-1 text-right">Consumed in Mix</th>
                  <th className="border border-slate-300 p-1 text-right">Closing Bal</th>
                </tr>
              </thead>
              <tbody>
                {skuRegrindRows.slice(0, 20).map(s => (
                  <tr key={s.id} className="even:bg-slate-50">
                    <td className="border border-slate-300 p-1 font-medium">{s.skuName}</td>
                    <td className="border border-slate-300 p-1">{s.color}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{s.regrindProducedKg.toFixed(1)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{s.productionRejectionKg.toFixed(1)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-bold">
                      {s.crushedDeltaKg > 0 ? `+${s.crushedDeltaKg.toFixed(1)}` : s.crushedDeltaKg.toFixed(1)}
                    </td>
                    <td className="border border-slate-300 p-1 text-center font-bold">{s.recoveryRatePercent.toFixed(0)}%</td>
                    <td className="border border-slate-300 p-1 text-right font-mono">{s.periodConsumedKg.toFixed(1)}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-bold">{s.closingBalanceKg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-400">
                <tr>
                  <td colSpan={2} className="border border-slate-300 p-1 text-right">TOTAL:</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalProduced.toFixed(1)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{totalRejection.toFixed(1)}</td>
                  <td className="border border-slate-300 p-1 text-right font-mono">{(totalProduced - totalRejection).toFixed(1)}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono">
                    {totalRejection > 0 ? ((totalProduced / totalRejection) * 100).toFixed(0) : 0}%
                  </td>
                  <td colSpan={2} className="border border-slate-300 p-1"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Authorization & Sign-off Section */}
          <div className="grid grid-cols-4 gap-6 pt-10 border-t border-slate-400 text-center text-xs font-semibold text-slate-800">
            <div>
              <div className="border-t border-slate-400 pt-1">Prepared By (Data Entry)</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Recycle / Mixing In-Charge</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Store Godown In-Charge</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Production Manager (Approval)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
