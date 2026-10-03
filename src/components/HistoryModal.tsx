import React, { useState } from 'react';
import {
  History,
  X,
  Calendar,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DailyReportSnapshot } from '../types';
import { exportReconciliationToCsv } from '../utils/exportUtils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DailyReportSnapshot[];
  activeSnapshotId?: string | null;
  onSelectReport: (report: DailyReportSnapshot) => void;
  onDeleteReport: (id: string) => void;
  onClearAllReports: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  reports,
  activeSnapshotId,
  onSelectReport,
  onDeleteReport,
  onClearAllReports,
}) => {
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Daily Reconciliation Archives</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                View, load into dashboard, or delete historical daily reconciliation snapshots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar when reports exist */}
        {reports.length > 0 && (
          <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Deleting an archive will immediately update the Dashboard and reports.
            </span>
            <div>
              {confirmClearAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 font-semibold text-[11px]">Clear all archives?</span>
                  <button
                    onClick={() => {
                      onClearAllReports();
                      setConfirmClearAll(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] transition shadow-xs"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearAll(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 font-medium transition"
                  title="Clear all saved daily reports and reset dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Archives</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* List of Reports */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {reports.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 border border-slate-700 flex items-center justify-center mx-auto">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300">No Saved Daily Archives</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All archives are clean. Click "Save Daily" on the top navigation bar anytime to store a daily reconciliation snapshot.
                </p>
              </div>
            </div>
          ) : (
            reports.map(rep => {
              const isActive = activeSnapshotId === rep.id;
              const isDeleting = deletingId === rep.id;

              return (
                <div
                  key={rep.id}
                  className={`bg-slate-950/80 border p-4 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isActive
                      ? 'border-cyan-500/60 ring-1 ring-cyan-500/30 shadow-md shadow-cyan-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white">{rep.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rep.unit === 'Unit-1'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                            : rep.unit === 'Unit-2'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                            : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                        }`}
                      >
                        {rep.unit === 'All' ? 'Consolidated' : rep.unit}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active in Dashboard</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        Report Date: {rep.date}
                      </span>
                      <span>•</span>
                      <span>Saved: {new Date(rep.savedAt).toLocaleDateString()} {new Date(rep.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Summary Metric Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-slate-300">
                        Tally Outward: <strong className="text-white font-mono">{rep.kpis.totalTallyOutwardKg.toFixed(1)} Kg</strong>
                      </span>
                      <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-slate-300">
                        Discrepancy: <strong className={`font-mono ${Math.abs(rep.kpis.totalVarianceKg) < 5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {rep.kpis.totalVarianceKg > 0 ? `+${rep.kpis.totalVarianceKg.toFixed(1)}` : rep.kpis.totalVarianceKg.toFixed(1)} Kg
                        </strong>
                      </span>
                      <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-slate-300">
                        Regrind Produced: <strong className="text-emerald-300 font-mono">{rep.kpis.totalRegrindProducedKg.toFixed(0)} Kg</strong>
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
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40'
                      }`}
                    >
                      <span>{isActive ? 'Loaded' : 'Load Snapshot'}</span>
                      {!isActive && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-700 p-1 rounded-xl">
                        <button
                          onClick={() => {
                            onDeleteReport(rep.id);
                            setDeletingId(null);
                          }}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition"
                          title="Confirm Delete"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(rep.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition"
                        title="Delete this archive (will update dashboard and reports)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/70">
          <span className="text-xs text-slate-400">
            {reports.length} snapshot {reports.length === 1 ? 'record' : 'records'} stored locally in PWA storage
          </span>
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
