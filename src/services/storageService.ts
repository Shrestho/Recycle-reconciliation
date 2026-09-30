import {
  DailyReportSnapshot,
  GoogleSheetConfig,
  ReconciliationRow,
  SkuRegrindVsRejectionItem,
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
} from '../types';
import {
  INITIAL_PRODUCTION_DATA,
  INITIAL_TALLY_OUTWARDS,
  INITIAL_REGRIND_BALANCE,
  INITIAL_RECONCILIATION_ROWS,
} from '../data/initialData';
import { computeSkuRegrindVsRejection } from '../utils/reconciliation';

const STORAGE_KEYS = {
  DAILY_REPORTS: 'astech_daily_reports_v1',
  CURRENT_DATE: 'astech_current_date_v1',
  CURRENT_UNIT: 'astech_current_unit_v1',
  GOOGLE_SHEET_CONFIG: 'astech_google_sheet_config_v1',
  STOCKS_OVERRIDE_PREFIX: 'astech_stocks_override_',
  PRODUCTION_DATA: 'astech_production_data_v1',
  TALLY_OUTWARDS: 'astech_tally_outwards_v1',
  REGRIND_BALANCE: 'astech_regrind_balance_v1',
};

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

  // Daily Reports Snapshots
  getSavedDailyReports(): DailyReportSnapshot[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY_REPORTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }

    // Default seeded initial report for 2026-09-24
    const initialSkuComp = computeSkuRegrindVsRejection(INITIAL_REGRIND_BALANCE, INITIAL_PRODUCTION_DATA);
    const initialSnapshot: DailyReportSnapshot = {
      id: 'snapshot-2026-09-24-All',
      date: '2026-09-24',
      unit: 'All',
      title: 'Daily Reconciliation & Regrind Report - 24 Sep 2026',
      savedAt: '2026-09-24T18:00:00.000Z',
      reconciliationRows: INITIAL_RECONCILIATION_ROWS,
      skuRegrindRows: initialSkuComp,
      kpis: {
        totalTallyOutwardKg: 5655.4,
        totalAppConsumedKg: 5413.4,
        totalProductionRmKg: 5350.0,
        totalMixingReturnKg: 242.0,
        totalOpeningStockKg: 532.0,
        totalClosingStockKg: 785.69,
        totalVarianceKg: -242.0,
        matchCount: 6,
        mismatchCount: 10,
        totalRejectionKg: 894.46,
        totalRegrindProducedKg: 3725.0,
        recoveryRatePercent: 416.4,
      },
      notes: 'Initial production and store outwards reconciliation for Unit-1 & Unit-2.',
      syncedToGoogleSheet: false,
    };

    localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify([initialSnapshot]));
    return [initialSnapshot];
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

  // Working raw datasets
  getProductionData(): ProductionItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTION_DATA);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PRODUCTION_DATA;
  },

  saveProductionData(data: ProductionItem[]) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTION_DATA, JSON.stringify(data));
  },

  getTallyOutwards(): TallyOutwardItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TALLY_OUTWARDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_TALLY_OUTWARDS;
  },

  saveTallyOutwards(data: TallyOutwardItem[]) {
    localStorage.setItem(STORAGE_KEYS.TALLY_OUTWARDS, JSON.stringify(data));
  },

  getRegrindBalance(): RegrindBalanceItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGRIND_BALANCE);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_REGRIND_BALANCE;
  },

  saveRegrindBalance(data: RegrindBalanceItem[]) {
    localStorage.setItem(STORAGE_KEYS.REGRIND_BALANCE, JSON.stringify(data));
  },

  resetToDefaultData() {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTION_DATA);
    localStorage.removeItem(STORAGE_KEYS.TALLY_OUTWARDS);
    localStorage.removeItem(STORAGE_KEYS.REGRIND_BALANCE);
  },
};
