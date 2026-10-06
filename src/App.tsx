import React, { useState, useEffect, useMemo } from 'react';
import {
  UnitType,
  ProductionSection,
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  ReconciliationRow,
  SkuRegrindVsRejectionItem,
  DailyReportSnapshot,
  GoogleSheetConfig,
  SkuNameMapping,
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
import { AccessLinkModal } from './components/AccessLinkModal';
import { SkuMappingModal } from './components/SkuMappingModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CheckCircle2, AlertTriangle, X, History, Trash2, ArrowRight } from 'lucide-react';

export default function App() {
  // Navigation & Date
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'reconciliation' | 'regrind'>('dashboard');
  const [selectedUnit, setSelectedUnit] = useState<UnitType>('All');
  const [selectedSection, setSelectedSection] = useState<ProductionSection>('All');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-01');

  // Core Datasets (empty [] by default)
  const [productionData, setProductionData] = useState<ProductionItem[]>(() => StorageService.getProductionData());
  const [tallyOutwards, setTallyOutwards] = useState<TallyOutwardItem[]>(() => StorageService.getTallyOutwards());
  const [regrindBalance, setRegrindBalance] = useState<RegrindBalanceItem[]>(() => StorageService.getRegrindBalance());

  // Floor Stocks Override (Opening, Closing, Notes)
  const [customStocks, setCustomStocks] = useState<Record<string, { opening: number; closing: number; notes?: string }>>(
    () => StorageService.getCustomStocks(selectedDate)
  );

  // Active Loaded Archive Snapshot (null in live edit mode)
  const [loadedArchiveSnapshot, setLoadedArchiveSnapshot] = useState<DailyReportSnapshot | null>(null);

  // Google Sheet Configuration & Sync state
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() =>
    StorageService.getGoogleSheetConfig()
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Daily Saved Reports History (empty by default)
  const [savedReports, setSavedReports] = useState<DailyReportSnapshot[]>(() =>
    StorageService.getSavedDailyReports()
  );

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSheetSettingsOpen, setIsSheetSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isAccessLinkOpen, setIsAccessLinkOpen] = useState(false);
  const [isSkuMappingOpen, setIsSkuMappingOpen] = useState(false);

  // SKU Similar Name Mappings Dictionary
  const [skuMappings, setSkuMappings] = useState<SkuNameMapping[]>(() =>
    StorageService.getSkuMappings()
  );

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
    // If viewing a locked archive, editing automatically transitions back to live mode
    if (loadedArchiveSnapshot) {
      setLoadedArchiveSnapshot(null);
    }
    const key = `${unit}_${materialName}`;
    const next = { opening, closing, notes };
    setCustomStocks(prev => ({
      ...prev,
      [key]: next,
    }));
    StorageService.saveCustomStock(selectedDate, key, next);
    setHasUnsavedChanges(true);
  };

  // Compute live Reconciliation rows or use snapshot rows if an archive is loaded
  const reconciliationRows: ReconciliationRow[] = useMemo(() => {
    if (loadedArchiveSnapshot) {
      return loadedArchiveSnapshot.reconciliationRows;
    }
    return computeReconciliationRows(tallyOutwards, productionData, customStocks);
  }, [loadedArchiveSnapshot, tallyOutwards, productionData, customStocks]);

  // Compute live SKU Wise Regrind vs Rejection rows or use snapshot rows if an archive is loaded
  // Uses active SKU Similar Name Mappings Dictionary
  const skuRegrindRows: SkuRegrindVsRejectionItem[] = useMemo(() => {
    if (loadedArchiveSnapshot) {
      return loadedArchiveSnapshot.skuRegrindRows;
    }
    return computeSkuRegrindVsRejection(regrindBalance, productionData, selectedSection, skuMappings);
  }, [loadedArchiveSnapshot, regrindBalance, productionData, selectedSection, skuMappings]);

  // Build current snapshot object for saving
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

    showToast(`Daily Report for ${selectedDate} (${selectedUnit}) saved to archives!`, 'success');

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

  // Clear all demo data, working records, and archives
  const handleClearAllData = () => {
    StorageService.clearAllData();
    setProductionData([]);
    setTallyOutwards([]);
    setRegrindBalance([]);
    setCustomStocks({});
    setSavedReports([]);
    setLoadedArchiveSnapshot(null);
    setHasUnsavedChanges(false);
    showToast('All demo data, archives, and working records cleared. System is clean!', 'success');
  };

  // Load official sample datasets (optional for preview)
  const handleLoadSampleData = () => {
    const loaded = StorageService.loadSampleDemoData();
    setProductionData(loaded.production);
    setTallyOutwards(loaded.tally);
    setRegrindBalance(loaded.regrind);
    setSelectedDate('2026-10-01');
    setSelectedUnit('All');
    setSelectedSection('All');
    setSavedReports(StorageService.getSavedDailyReports());
    setLoadedArchiveSnapshot(null);
    setCustomStocks(StorageService.getCustomStocks('2026-10-01'));
    showToast('Loaded 01-Oct-2026 sample operational datasets and archives!', 'success');
  };

  // Restore snapshot from history into Dashboard
  const handleSelectHistoryReport = (rep: DailyReportSnapshot) => {
    setLoadedArchiveSnapshot(rep);
    setSelectedDate(rep.date);
    setSelectedUnit(rep.unit);
    setCurrentTab('dashboard');
    showToast(`Loaded archive for ${rep.date} (${rep.unit}) into Dashboard`, 'info');
  };

  // Unload snapshot back to live edit mode
  const handleUnloadSnapshot = () => {
    setLoadedArchiveSnapshot(null);
    showToast('Exited archive view. Showing live working view.', 'info');
  };

  // Delete an archived report - UPDATES DASHBOARD AND REPORTS IMMEDIATELY
  const handleDeleteHistoryReport = (id: string) => {
    const repToDelete = savedReports.find(r => r.id === id);
    StorageService.deleteDailyReport(id);
    const updatedReports = StorageService.getSavedDailyReports();
    setSavedReports(updatedReports);

    // If the active loaded snapshot was this report, unload and reset
    if (loadedArchiveSnapshot?.id === id) {
      setLoadedArchiveSnapshot(null);
      // Clear working dataset for that date so dashboard reflects 0
      setProductionData([]);
      setTallyOutwards([]);
      setRegrindBalance([]);
      setCustomStocks({});
      StorageService.clearAllData();
    } else if (repToDelete && repToDelete.date === selectedDate) {
      // If the report being deleted is for the current selected date, also reset working data
      StorageService.clearCustomStocksForDate(selectedDate);
      setCustomStocks({});
      setProductionData([]);
      setTallyOutwards([]);
      setRegrindBalance([]);
      StorageService.clearAllData();
    }

    showToast(`Archived report deleted. Dashboard and reports updated.`, 'info');
  };

  // Clear all archives - UPDATES DASHBOARD AND ALL TABS TO CLEAN STATE
  const handleClearAllHistoryReports = () => {
    StorageService.clearAllDailyReports();
    StorageService.clearAllData();
    setSavedReports([]);
    setLoadedArchiveSnapshot(null);
    setProductionData([]);
    setTallyOutwards([]);
    setRegrindBalance([]);
    setCustomStocks({});
    setHasUnsavedChanges(false);
    showToast('All daily archives cleared. Dashboard and reports updated to clean state.', 'info');
  };

  // Save SKU Similar Name Mappings
  const handleSaveSkuMappings = (updated: SkuNameMapping[]) => {
    setSkuMappings(updated);
    StorageService.saveSkuMappings(updated);
    showToast(`Updated ${updated.length} SKU similar name mappings!`, 'success');
  };

  // Reset SKU Mappings to Factory Default
  const handleResetSkuMappings = () => {
    const def = StorageService.resetSkuMappingsToDefault();
    setSkuMappings(def);
    showToast('Reset SKU name mappings to ASTECH factory default dictionary!', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenImport={() => {
          if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
          setIsImportOpen(true);
        }}
        onSaveReport={handleSaveDailyReport}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSheetSettings={() => setIsSheetSettingsOpen(true)}
        onOpenPrint={() => setIsPrintOpen(true)}
        onOpenAccessLink={() => setIsAccessLinkOpen(true)}
        onClearAllData={handleClearAllData}
        savedReportsCount={savedReports.length}
        loadedArchiveSnapshot={loadedArchiveSnapshot}
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
            selectedSection={selectedSection}
            selectedDate={selectedDate}
            loadedArchiveSnapshot={loadedArchiveSnapshot}
            savedReports={savedReports}
            onNavigateToTab={setCurrentTab}
            onOpenImport={() => {
              if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
              setIsImportOpen(true);
            }}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onUnloadSnapshot={handleUnloadSnapshot}
            onDeleteSnapshot={handleDeleteHistoryReport}
            onLoadSnapshot={handleSelectHistoryReport}
            onLoadSampleData={handleLoadSampleData}
            onClearAllData={handleClearAllData}
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
            onOpenSkuMappings={() => setIsSkuMappingOpen(true)}
            skuMappingsCount={skuMappings.length}
          />
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>ASTECH LIMITED &copy; 2026 — Multi-Unit ERP & Recycle Management System</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAccessLinkOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
            >
              Share Access Link
            </button>
            <span>•</span>
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
              onClick={handleClearAllData}
              className="text-rose-400 hover:text-rose-300 underline font-medium"
              title="Clear all demo data and archives"
            >
              Clear All Data
            </button>
            <span>•</span>
            <button
              onClick={handleLoadSampleData}
              className="hover:text-slate-300 underline"
            >
              Load Demo Sample
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportProduction={(items, mode = 'merge') => {
          if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
          if (mode === 'replace') {
            setProductionData(items);
            StorageService.saveProductionData(items);
          } else {
            setProductionData(prev => {
              const map = new Map<string, ProductionItem>();
              prev.forEach(p => map.set(`${p.unit}_${p.machineSerial || p.productName}`, p));
              items.forEach(p => map.set(`${p.unit}_${p.machineSerial || p.productName}`, p));
              const combined = Array.from(map.values());
              StorageService.saveProductionData(combined);
              return combined;
            });
          }
          setHasUnsavedChanges(true);
          showToast(`Processed ${items.length} production items!`, 'success');
        }}
        onImportTally={(items, mode = 'merge') => {
          if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
          if (mode === 'replace') {
            setTallyOutwards(items);
            StorageService.saveTallyOutwards(items);
          } else {
            setTallyOutwards(prev => {
              const map = new Map<string, TallyOutwardItem>();
              prev.forEach(t => map.set(`${t.unit}_${t.materialName}`, t));
              items.forEach(t => map.set(`${t.unit}_${t.materialName}`, t));
              const combined = Array.from(map.values());
              StorageService.saveTallyOutwards(combined);
              return combined;
            });
          }
          setHasUnsavedChanges(true);
          showToast(`Processed ${items.length} Tally outward records!`, 'success');
        }}
        onImportRegrind={(items, mode = 'merge') => {
          if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
          if (mode === 'replace') {
            setRegrindBalance(items);
            StorageService.saveRegrindBalance(items);
          } else {
            setRegrindBalance(prev => {
              const map = new Map<string, RegrindBalanceItem>();
              prev.forEach(r => map.set(`${r.skuName}_${r.color}`, r));
              items.forEach(r => map.set(`${r.skuName}_${r.color}`, r));
              const combined = Array.from(map.values());
              StorageService.saveRegrindBalance(combined);
              return combined;
            });
          }
          setHasUnsavedChanges(true);
          showToast(`Processed ${items.length} Regrind balance records!`, 'success');
        }}
        onImportBatch={batch => {
          if (loadedArchiveSnapshot) setLoadedArchiveSnapshot(null);
          if (batch.mode === 'replace') {
            if (batch.productionItems.length > 0) {
              setProductionData(batch.productionItems);
              StorageService.saveProductionData(batch.productionItems);
            }
            if (batch.tallyItems.length > 0) {
              setTallyOutwards(batch.tallyItems);
              StorageService.saveTallyOutwards(batch.tallyItems);
            }
            if (batch.regrindItems.length > 0) {
              setRegrindBalance(batch.regrindItems);
              StorageService.saveRegrindBalance(batch.regrindItems);
            }
          } else {
            // MERGE / COMBINE MODE (e.g. Blow + Injection, Unit-1 + Unit-2)
            if (batch.productionItems.length > 0) {
              setProductionData(prev => {
                const map = new Map<string, ProductionItem>();
                prev.forEach(p => map.set(`${p.unit}_${p.machineSerial || p.productName}`, p));
                batch.productionItems.forEach(p => map.set(`${p.unit}_${p.machineSerial || p.productName}`, p));
                const combined = Array.from(map.values());
                StorageService.saveProductionData(combined);
                return combined;
              });
            }
            if (batch.tallyItems.length > 0) {
              setTallyOutwards(prev => {
                const map = new Map<string, TallyOutwardItem>();
                prev.forEach(t => map.set(`${t.unit}_${t.materialName}`, t));
                batch.tallyItems.forEach(t => map.set(`${t.unit}_${t.materialName}`, t));
                const combined = Array.from(map.values());
                StorageService.saveTallyOutwards(combined);
                return combined;
              });
            }
            if (batch.regrindItems.length > 0) {
              setRegrindBalance(prev => {
                const map = new Map<string, RegrindBalanceItem>();
                prev.forEach(r => map.set(`${r.skuName}_${r.color}`, r));
                batch.regrindItems.forEach(r => map.set(`${r.skuName}_${r.color}`, r));
                const combined = Array.from(map.values());
                StorageService.saveRegrindBalance(combined);
                return combined;
              });
            }
          }
          setHasUnsavedChanges(true);
          showToast(`Successfully imported and combined all selected files!`, 'success');
        }}
        onImportSkuMappings={newMappings => {
          const existingKeys = new Set(
            skuMappings.map(m => `${m.regrindSkuName.toLowerCase()}__${m.productionSkuName.toLowerCase()}`)
          );
          const filtered = newMappings.filter(
            m => !existingKeys.has(`${m.regrindSkuName.toLowerCase()}__${m.productionSkuName.toLowerCase()}`)
          );
          const merged = [...filtered, ...skuMappings];
          handleSaveSkuMappings(merged);
        }}
        onLoadSampleData={handleLoadSampleData}
        selectedUnit={selectedUnit}
        selectedDate={selectedDate}
      />

      <SkuMappingModal
        isOpen={isSkuMappingOpen}
        onClose={() => setIsSkuMappingOpen(false)}
        mappings={skuMappings}
        onSaveMappings={handleSaveSkuMappings}
        onResetDefault={handleResetSkuMappings}
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
        activeSnapshotId={loadedArchiveSnapshot?.id}
        onSelectReport={handleSelectHistoryReport}
        onDeleteReport={handleDeleteHistoryReport}
        onClearAllReports={handleClearAllHistoryReports}
      />

      <PrintReportModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        reconciliationRows={reconciliationRows}
        skuRegrindRows={skuRegrindRows}
        selectedUnit={selectedUnit}
        selectedDate={selectedDate}
      />

      <AccessLinkModal
        isOpen={isAccessLinkOpen}
        onClose={() => setIsAccessLinkOpen(false)}
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
