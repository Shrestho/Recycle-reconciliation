import React from 'react';
import {
  History,
  X,
  Calendar,
  Trash2,
  ExternalLink,
  Download,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { DailyReportSnapshot } from '../types';
import { exportReconciliationToCsv } from '../utils/exportUtils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DailyReportSnapshot[];
  onSelectReport: (report: DailyReportSnapshot) => void;
  onDeleteReport: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  reports,
  onSelectReport,
  onDeleteReport,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Daily Reconciliation Archives</h3>
              <p className="text-xs text-slate-400">
                View, reload, or export historical daily reconciliation snapshots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Reports */}
        <div className="p-6 overflow-y-auto space-y-3">
          {reports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No saved daily reports yet. Click "Save Daily" on the top bar to record a report snapshot.
            </div>
          ) : (
            reports.map(rep => (
              <div
                key={rep.id}
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 p-4 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{rep.title}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                        rep.unit === 'Unit-1'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                          : rep.unit === 'Unit-2'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                          : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                      }`}
                    >
                      {rep.unit}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Date: {rep.date}
                    </span>
                    <span>•</span>
                    <span>Saved: {new Date(rep.savedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <span className="text-slate-300">
                      Tally Outward: <strong className="text-white font-mono">{rep.kpis.totalTallyOutwardKg.toFixed(1)} Kg</strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300">
                      Variance: <strong className="text-amber-400 font-mono">{rep.kpis.totalVarianceKg.toFixed(1)} Kg</strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300">
                      Regrind Crushed: <strong className="text-emerald-300 font-mono">{rep.kpis.totalRegrindProducedKg.toFixed(0)} Kg</strong>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      exportReconciliationToCsv(rep.reconciliationRows, rep.date, rep.unit);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                    title="Download Snapshot CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      onSelectReport(rep);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition"
                  >
                    Load Snapshot
                  </button>

                  <button
                    onClick={() => onDeleteReport(rep.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
