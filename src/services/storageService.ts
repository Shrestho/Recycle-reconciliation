import {
  DailyReportSnapshot,
  GoogleSheetConfig,
  ReconciliationRow,
  SkuRegrindVsRejectionItem,
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  SkuNameMapping,
} from '../types';
import {
  INITIAL_PRODUCTION_DATA,
  INITIAL_TALLY_OUTWARDS,
  INITIAL_REGRIND_BALANCE,
} from '../data/initialData';
import { DEFAULT_SKU_MAPPINGS } from '../data/defaultSkuMappings';
import { computeSkuRegrindVsRejection, computeReconciliationRows } from '../utils/reconciliation';

const STORAGE_KEYS = {
  DAILY_REPORTS: 'astech_daily_reports_v3',
  CURRENT_DATE: 'astech_current_date_v3',
  CURRENT_UNIT: 'astech_current_unit_v3',
  GOOGLE_SHEET_CONFIG: 'astech_google_sheet_config_v3',
  STOCKS_OVERRIDE_PREFIX: 'astech_stocks_override_v3_',
  PRODUCTION_DATA: 'astech_production_data_v3',
  TALLY_OUTWARDS: 'astech_tally_outwards_v3',
  REGRIND_BALANCE: 'astech_regrind_balance_v3',
  DEMO_CLEARED_FLAG: 'astech_demo_cleared_v3',
  SKU_MAPPINGS: 'astech_sku_mappings_v1',
};

// Automatic one-time cleanup of old demo/seeded data from previous versions
(function performOneTimeDemoCleanup() {
  try {
    if (typeof window !== 'undefined' && localStorage) {
      if (localStorage.getItem(STORAGE_KEYS.DEMO_CLEARED_FLAG) !== 'true') {
        // Clear all previous v2/demo keys
        localStorage.removeItem('astech_daily_reports_v2');
        localStorage.removeItem('astech_production_data_v2');
        localStorage.removeItem('astech_tally_outwards_v2');
        localStorage.removeItem('astech_regrind_balance_v2');
        localStorage.removeItem(STORAGE_KEYS.DAILY_REPORTS);
        localStorage.removeItem(STORAGE_KEYS.PRODUCTION_DATA);
        localStorage.removeItem(STORAGE_KEYS.TALLY_OUTWARDS);
        localStorage.removeItem(STORAGE_KEYS.REGRIND_BALANCE);

        // Remove old stock overrides
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('astech_stocks_override_')) {
            localStorage.removeItem(key);
          }
        });

        // Set demo cleared flag
        localStorage.setItem(STORAGE_KEYS.DEMO_CLEARED_FLAG, 'true');
      }
    }
  } catch (e) {
    console.error('Error during initial demo cleanup:', e);
  }
})();

export const StorageService = {
  // Google Sheets configuration
  getGoogleSheetConfig(): GoogleSheetConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      webhookUrl: '',
      autoSync: false,
      status: 'idle',
    };
  },

  saveGoogleSheetConfig(config: GoogleSheetConfig) {
    localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET_CONFIG, JSON.stringify(config));
  },

  // Daily Reports Snapshots - Starts completely empty unless user saves or loads sample data
  getSavedDailyReports(): DailyReportSnapshot[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY_REPORTS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveDailyReport(report: DailyReportSnapshot) {
    const reports = this.getSavedDailyReports();
    const existingIndex = reports.findIndex(r => r.date === report.date && r.unit === report.unit);
    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.unshift(report);
    }
    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(reports));
  },

  deleteDailyReport(id: string) {
    const reports = this.getSavedDailyReports().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(reports));
  },

  clearAllDailyReports() {
    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify([]));
  },

  // Stock overrides (Opening, Closing, Notes)
  getCustomStocks(date: string): Record<string, { opening: number; closing: number; notes?: string }> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCKS_OVERRIDE_PREFIX + date);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {};
  },

  saveCustomStock(
    date: string,
    key: string,
    data: { opening: number; closing: number; notes?: string }
  ) {
    const all = this.getCustomStocks(date);
    all[key] = data;
    localStorage.setItem(STORAGE_KEYS.STOCKS_OVERRIDE_PREFIX + date, JSON.stringify(all));
  },

  clearCustomStocksForDate(date: string) {
    try {
      localStorage.removeItem(STORAGE_KEYS.STOCKS_OVERRIDE_PREFIX + date);
    } catch (e) {
      console.error(e);
    }
  },

  // Working raw datasets - Returns empty [] by default (no demo data)
  getProductionData(): ProductionItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTION_DATA);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  },

  saveProductionData(data: ProductionItem[]) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTION_DATA, JSON.stringify(data));
  },

  getTallyOutwards(): TallyOutwardItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TALLY_OUTWARDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  },

  saveTallyOutwards(data: TallyOutwardItem[]) {
    localStorage.setItem(STORAGE_KEYS.TALLY_OUTWARDS, JSON.stringify(data));
  },

  getRegrindBalance(): RegrindBalanceItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGRIND_BALANCE);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  },

  saveRegrindBalance(data: RegrindBalanceItem[]) {
    localStorage.setItem(STORAGE_KEYS.REGRIND_BALANCE, JSON.stringify(data));
  },

  // Clear all data (demo, working datasets, stock overrides, archives)
  clearAllData() {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTION_DATA, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TALLY_OUTWARDS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.REGRIND_BALANCE, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.DEMO_CLEARED_FLAG, 'true');

      // Clear all stock overrides
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('astech_stocks_override_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error clearing all data:', e);
    }
  },

  // Explicitly load 01-Oct-2026 official sample demo datasets if the user wants to test
  loadSampleDemoData(): {
    production: ProductionItem[];
    tally: TallyOutwardItem[];
    regrind: RegrindBalanceItem[];
    snapshot: DailyReportSnapshot;
  } {
    const initialSkuComp = computeSkuRegrindVsRejection(INITIAL_REGRIND_BALANCE, INITIAL_PRODUCTION_DATA);
    const initialRecRows = computeReconciliationRows(INITIAL_TALLY_OUTWARDS, INITIAL_PRODUCTION_DATA);

    const totalTally = initialRecRows.reduce((s, r) => s + r.tallyOutwardKg, 0);
    const totalApp = initialRecRows.reduce((s, r) => s + r.appConsumedKg, 0);
    const totalProd = initialRecRows.reduce((s, r) => s + r.productionRmConsumptionKg, 0);
    const totalReturn = initialRecRows.reduce((s, r) => s + r.mixingReturnKg, 0);
    const totalOpen = initialRecRows.reduce((s, r) => s + r.openingStockKg, 0);
    const totalClose = initialRecRows.reduce((s, r) => s + r.closingStockKg, 0);
    const totalVar = initialRecRows.reduce((s, r) => s + r.varianceKg, 0);

    const totalRej = initialSkuComp.reduce((s, r) => s + r.productionRejectionKg, 0);
    const totalProduced = initialSkuComp.reduce((s, r) => s + r.regrindProducedKg, 0);
    const recoveryRate = totalRej > 0 ? (totalProduced / totalRej) * 100 : 0;

    const snapshot: DailyReportSnapshot = {
      id: 'snapshot-2026-10-01-All',
      date: '2026-10-01',
      unit: 'All',
      title: 'Daily Reconciliation & Regrind Report - 01 Oct 2026',
      savedAt: '2026-10-01T18:00:00.000Z',
      reconciliationRows: initialRecRows,
      skuRegrindRows: initialSkuComp,
      kpis: {
        totalTallyOutwardKg: totalTally,
        totalAppConsumedKg: totalApp,
        totalProductionRmKg: totalProd,
        totalMixingReturnKg: totalReturn,
        totalOpeningStockKg: totalOpen,
        totalClosingStockKg: totalClose,
        totalVarianceKg: totalVar,
        matchCount: initialRecRows.filter(r => r.status === 'Match').length,
        mismatchCount: initialRecRows.filter(r => r.status === 'Mismatch').length,
        totalRejectionKg: totalRej,
        totalRegrindProducedKg: totalProduced,
        recoveryRatePercent: Number(recoveryRate.toFixed(1)),
      },
      notes: 'Official 01-Oct-2026 sample datasets for Blow, Injection, Unit-1, and Unit-2.',
      syncedToGoogleSheet: false,
    };

    this.saveProductionData(INITIAL_PRODUCTION_DATA);
    this.saveTallyOutwards(INITIAL_TALLY_OUTWARDS);
    this.saveRegrindBalance(INITIAL_REGRIND_BALANCE);
    this.saveDailyReport(snapshot);

    return {
      production: INITIAL_PRODUCTION_DATA,
      tally: INITIAL_TALLY_OUTWARDS,
      regrind: INITIAL_REGRIND_BALANCE,
      snapshot,
    };
  },

  // SKU Name Mappings (Regrind SKU Name <-> Production SKU / Item Name)
  getSkuMappings(): SkuNameMapping[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SKU_MAPPINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading sku mappings:', e);
    }
    return DEFAULT_SKU_MAPPINGS;
  },

  saveSkuMappings(mappings: SkuNameMapping[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.SKU_MAPPINGS, JSON.stringify(mappings));
    } catch (e) {
      console.error('Error saving sku mappings:', e);
    }
  },

  resetSkuMappingsToDefault(): SkuNameMapping[] {
    this.saveSkuMappings(DEFAULT_SKU_MAPPINGS);
    return DEFAULT_SKU_MAPPINGS;
  },
};
