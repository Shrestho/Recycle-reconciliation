import React, { useState, useEffect, useMemo } from 'react';
import {
  UnitType,
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  ReconciliationRow,
  SkuRegrindVsRejectionItem,
  DailyReportSnapshot,
  GoogleSheetConfig,
} from './types';
import { StorageService } from './services/storageService';
import { computeReconciliationRows, computeSkuRegrindVsRejection } from './utils/reconciliation';
import { syncReportToGoogleSheet } from './utils/googleSheetsSync';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ReconciliationReportView } from './components/ReconciliationReportView';
import { RegrindReportView } from './components/RegrindReportView';
import { ImportModal } from './components/ImportModal';
import { GoogleSheetSettingsModal } from './components/GoogleSheetSettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { PrintReportModal } from './components/PrintReportModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  // Navigation & Date
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'reconciliation' | 'regrind'>('dashboard');
  const [selectedUnit, setSelectedUnit] = useState<UnitType>('All');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-24');

  // Core Datasets
  const [productionData, setProductionData] = useState<ProductionItem[]>(() => StorageService.getProductionData());
  const [tallyOutwards, setTallyOutwards] = useState<TallyOutwardItem[]>(() => StorageService.getTallyOutwards());
  const [regrindBalance, setRegrindBalance] = useState<RegrindBalanceItem[]>(() => StorageService.getRegrindBalance());

  // Floor Stocks Override (Opening, Closing, Notes)
  const [customStocks, setCustomStocks] = useState<Record<string, { opening: number; closing: number; notes?: string }>>(
    () => StorageService.getCustomStocks(selectedDate)
  );

  // Google Sheet Configuration & Sync state
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() =>
    StorageService.getGoogleSheetConfig()
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Daily Saved Reports History
  const [savedReports, setSavedReports] = useState<DailyReportSnapshot[]>(() =>
    StorageService.getSavedDailyReports()
  );

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSheetSettingsOpen, setIsSheetSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Reload custom stocks when date changes
  useEffect(() => {
    setCustomStocks(StorageService.getCustomStocks(selectedDate));
  }, [selectedDate]);

  // Handle stock edits in table
  const handleUpdateStock = (
    unit: 'Unit-1' | 'Unit-2',
    materialName: string,
    opening: number,
    closing: number,
    notes?: string
  ) => {
    const key = `${unit}_${materialName}`;
    const next = { opening, closing, notes };
    setCustomStocks(prev => ({
      ...prev,
      [key]: next,
    }));
    StorageService.saveCustomStock(selectedDate, key, next);
    setHasUnsavedChanges(true);
  };

  // Compute live Reconciliation rows
  const reconciliationRows: ReconciliationRow[] = useMemo(() => {
    return computeReconciliationRows(tallyOutwards, productionData, customStocks);
  }, [tallyOutwards, productionData, customStocks]);

  // Compute live SKU Wise Regrind vs Rejection rows
  const skuRegrindRows: SkuRegrindVsRejectionItem[] = useMemo(() => {
    return computeSkuRegrindVsRejection(regrindBalance, productionData);
  }, [regrindBalance, productionData]);

  // Build current snapshot object
  const currentSnapshot: DailyReportSnapshot = useMemo(() => {
    const filteredRec = reconciliationRows.filter(
      r => selectedUnit === 'All' || r.unit === selectedUnit
    );

    const totalTally = filteredRec.reduce((s, r) => s + r.tallyOutwardKg, 0);
    const totalApp = filteredRec.reduce((s, r) => s + r.appConsumedKg, 0);
    const totalProd = filteredRec.reduce((s, r) => s + r.productionRmConsumptionKg, 0);
    const totalReturn = filteredRec.reduce((s, r) => s + r.mixingReturnKg, 0);
    const totalOpen = filteredRec.reduce((s, r) => s + r.openingStockKg, 0);
    const totalClose = filteredRec.reduce((s, r) => s + r.closingStockKg, 0);
    const totalVar = filteredRec.reduce((s, r) => s + r.varianceKg, 0);

    const matchCount = filteredRec.filter(r => r.status === 'Match').length;
    const mismatchCount = filteredRec.filter(r => r.status === 'Mismatch').length;

    const totalRej = skuRegrindRows.reduce((s, r) => s + r.productionRejectionKg, 0);
    const totalProduced = skuRegrindRows.reduce((s, r) => s + r.regrindProducedKg, 0);
    const recoveryRate = totalRej > 0 ? (totalProduced / totalRej) * 100 : 0;

    return {
      id: `report-${selectedDate}-${selectedUnit}`,
      date: selectedDate,
      unit: selectedUnit,
      title: `Reconciliation & Regrind Report (${selectedUnit}) - ${selectedDate}`,
      savedAt: new Date().toISOString(),
      reconciliationRows: filteredRec,
      skuRegrindRows,
      kpis: {
        totalTallyOutwardKg: totalTally,
        totalAppConsumedKg: totalApp,
        totalProductionRmKg: totalProd,
        totalMixingReturnKg: totalReturn,
        totalOpeningStockKg: totalOpen,
        totalClosingStockKg: totalClose,
        totalVarianceKg: totalVar,
        matchCount,
        mismatchCount,
        totalRejectionKg: totalRej,
        totalRegrindProducedKg: totalProduced,
        recoveryRatePercent: Number(recoveryRate.toFixed(1)),
      },
    };
  }, [reconciliationRows, skuRegrindRows, selectedDate, selectedUnit]);

  // Save Daily Report and optionally sync to Google Sheet
  const handleSaveDailyReport = async () => {
    StorageService.saveDailyReport(currentSnapshot);
    setSavedReports(StorageService.getSavedDailyReports());
    setHasUnsavedChanges(false);

    showToast(`Daily Report for ${selectedDate} (${selectedUnit}) saved locally!`, 'success');

    // Auto-sync to Google Sheet if configured
    if (googleSheetConfig.webhookUrl && googleSheetConfig.autoSync) {
      setIsSyncing(true);
      const res = await syncReportToGoogleSheet(currentSnapshot, googleSheetConfig);
      setIsSyncing(false);

      if (res.success) {
        const updatedConfig = {
          ...googleSheetConfig,
          lastSyncedAt: new Date().toISOString(),
          status: 'success' as const,
        };
        setGoogleSheetConfig(updatedConfig);
        StorageService.saveGoogleSheetConfig(updatedConfig);
        showToast('Daily report synced directly to Google Sheet!', 'success');
      } else {
        showToast(`Google Sheet Sync: ${res.message}`, 'error');
      }
    }
  };

  // Load official sample datasets
  const handleLoadSampleData = () => {
    StorageService.resetToDefaultData();
    setProductionData(StorageService.getProductionData());
    setTallyOutwards(StorageService.getTallyOutwards());
    setRegrindBalance(StorageService.getRegrindBalance());
    setSelectedDate('2026-09-24');
    setSelectedUnit('All');
    setCustomStocks(StorageService.getCustomStocks('2026-09-24'));
    showToast('Loaded 24-Sep-2026 official operational datasets!', 'success');
  };

  // Restore snapshot from history
  const handleSelectHistoryReport = (rep: DailyReportSnapshot) => {
    setSelectedDate(rep.date);
    setSelectedUnit(rep.unit);
    showToast(`Loaded archive for ${rep.date} (${rep.unit})`, 'info');
  };

  const handleDeleteHistoryReport = (id: string) => {
    StorageService.deleteDailyReport(id);
    setSavedReports(StorageService.getSavedDailyReports());
    showToast('Archived report deleted.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenImport={() => setIsImportOpen(true)}
        onSaveReport={handleSaveDailyReport}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSheetSettings={() => setIsSheetSettingsOpen(true)}
        onOpenPrint={() => setIsPrintOpen(true)}
        googleSheetConfig={googleSheetConfig}
        isSyncing={isSyncing}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5">
        {currentTab === 'dashboard' && (
          <DashboardView
            reconciliationRows={reconciliationRows}
            skuRegrindRows={skuRegrindRows}
            selectedUnit={selectedUnit}
            selectedDate={selectedDate}
            onNavigateToTab={setCurrentTab}
            onOpenImport={() => setIsImportOpen(true)}
          />
        )}

        {currentTab === 'reconciliation' && (
          <ReconciliationReportView
            rows={reconciliationRows}
            selectedUnit={selectedUnit}
            selectedDate={selectedDate}
            onUpdateStock={handleUpdateStock}
            onSaveReport={handleSaveDailyReport}
          />
        )}

        {currentTab === 'regrind' && (
          <RegrindReportView
            items={skuRegrindRows}
            selectedUnit={selectedUnit}
            selectedDate={selectedDate}
          />
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>ASTECH LIMITED &copy; 2026 — Multi-Unit ERP & Recycle Management System</span>
          <div className="flex items-center gap-3">
            <span>Offline-Ready PWA</span>
            <span>•</span>
            <button
              onClick={() => setIsSheetSettingsOpen(true)}
              className="hover:text-slate-300 underline"
            >
              Google Sheet Webhook
            </button>
            <span>•</span>
            <button
              onClick={handleLoadSampleData}
              className="hover:text-slate-300 underline"
            >
              Reset 24-Sep Data
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportProduction={items => {
          setProductionData(items);
          StorageService.saveProductionData(items);
          setHasUnsavedChanges(true);
          showToast(`Imported ${items.length} production items!`, 'success');
        }}
        onImportTally={items => {
          setTallyOutwards(items);
          StorageService.saveTallyOutwards(items);
          setHasUnsavedChanges(true);
          showToast(`Imported ${items.length} Tally outward records!`, 'success');
        }}
        onImportRegrind={items => {
          setRegrindBalance(items);
          StorageService.saveRegrindBalance(items);
          setHasUnsavedChanges(true);
          showToast(`Imported ${items.length} Regrind balance records!`, 'success');
        }}
        onLoadSampleData={handleLoadSampleData}
        selectedUnit={selectedUnit}
        selectedDate={selectedDate}
      />

      <GoogleSheetSettingsModal
        isOpen={isSheetSettingsOpen}
        onClose={() => setIsSheetSettingsOpen(false)}
        config={googleSheetConfig}
        onSaveConfig={cfg => {
          setGoogleSheetConfig(cfg);
          StorageService.saveGoogleSheetConfig(cfg);
          showToast('Google Sheet settings saved!', 'success');
        }}
        latestReport={currentSnapshot}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        reports={savedReports}
        onSelectReport={handleSelectHistoryReport}
        onDeleteReport={handleDeleteHistoryReport}
      />

      <PrintReportModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        reconciliationRows={reconciliationRows}
        skuRegrindRows={skuRegrindRows}
        selectedUnit={selectedUnit}
        selectedDate={selectedDate}
      />

      {/* PWA Offline Banner */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md border animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : 'bg-blue-950/90 border-blue-700 text-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 p-0.5 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
