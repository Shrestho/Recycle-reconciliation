import React from 'react';
import {
  Factory,
  BarChart3,
  Scale,
  Recycle,
  Upload,
  Save,
  FileSpreadsheet,
  History,
  Printer,
  CloudCheck,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { UnitType, GoogleSheetConfig } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  currentTab: 'dashboard' | 'reconciliation' | 'regrind';
  onTabChange: (tab: 'dashboard' | 'reconciliation' | 'regrind') => void;
  selectedUnit: UnitType;
  onUnitChange: (unit: UnitType) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenImport: () => void;
  onSaveReport: () => void;
  onOpenHistory: () => void;
  onOpenSheetSettings: () => void;
  onOpenPrint: () => void;
  googleSheetConfig: GoogleSheetConfig;
  isSyncing: boolean;
  hasUnsavedChanges: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  selectedUnit,
  onUnitChange,
  selectedDate,
  onDateChange,
  onOpenImport,
  onSaveReport,
  onOpenHistory,
  onOpenSheetSettings,
  onOpenPrint,
  googleSheetConfig,
  isSyncing,
  hasUnsavedChanges,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md">
      {/* Top Banner with Brand and Controls */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Organization */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Factory className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">ASTECH LIMITED</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/60 uppercase tracking-wider">
                  ERP & Recycle
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tally ERP Outwards vs Mixing vs Production RM Reconciliation
              </p>
            </div>
          </div>

          {/* Unit Selector, Date & Top Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Unit Selector */}
            <div className="flex items-center bg-slate-950/80 rounded-xl p-1 border border-slate-800">
              {(['All', 'Unit-1', 'Unit-2'] as UnitType[]).map(unit => (
                <button
                  key={unit}
                  onClick={() => onUnitChange(unit)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedUnit === unit
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {unit === 'All' ? 'Consolidated' : unit}
                </button>
              ))}
            </div>

            {/* Date input */}
            <div className="flex items-center bg-slate-950/80 rounded-xl px-2.5 py-1 border border-slate-800 text-xs">
              <span className="text-slate-400 mr-2 text-[11px] font-medium hidden sm:inline">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => onDateChange(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-hidden text-xs cursor-pointer"
              />
            </div>

            {/* Google Sheet Sync Quick Indicator */}
            <button
              onClick={onOpenSheetSettings}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                googleSheetConfig.webhookUrl
                  ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60'
              }`}
              title={
                googleSheetConfig.webhookUrl
                  ? `Google Sheet Connected (${googleSheetConfig.lastSyncedAt ? 'Last: ' + new Date(googleSheetConfig.lastSyncedAt).toLocaleTimeString() : 'Ready'})`
                  : 'Connect Google Sheet without Auth'
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : googleSheetConfig.webhookUrl ? (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden md:inline">
                {isSyncing ? 'Syncing...' : googleSheetConfig.webhookUrl ? 'Sheet Linked' : 'Link Sheet'}
              </span>
            </button>

            {/* Save Daily Report Button */}
            <button
              onClick={onSaveReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-950/50 transition active:scale-95"
              title="Save Daily Snapshot & Sync to Google Sheet"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Daily</span>
              {hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </button>

            {/* Import Button */}
            <button
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
              title="Import Production, Tally or Regrind CSV"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="View Daily Saved Reports History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Print / PDF Button */}
            <button
              onClick={onOpenPrint}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Printable Executive Report"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* PWA Install Component */}
            <PWAInstallButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              currentTab === 'dashboard'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Visual Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('reconciliation')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              currentTab === 'reconciliation'
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Tally Outwards vs Mixing vs RM Consumption</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-900/60 text-blue-300 font-normal">
              Opening/Closing Stock
            </span>
          </button>

          <button
            onClick={() => onTabChange('regrind')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              currentTab === 'regrind'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Recycle className="w-3.5 h-3.5" />
            <span>SKU Regrind Produced vs Production Rejection</span>
          </button>
        </div>
      </div>
    </header>
  );
};
