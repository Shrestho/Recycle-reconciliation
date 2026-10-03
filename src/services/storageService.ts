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
} from '../data/initialData';
import { computeSkuRegrindVsRejection, computeReconciliationRows } from '../utils/reconciliation';

const STORAGE_KEYS = {
  DAILY_REPORTS: 'astech_daily_reports_v2',
  CURRENT_DATE: 'astech_current_date_v2',
  CURRENT_UNIT: 'astech_current_unit_v2',
  GOOGLE_SHEET_CONFIG: 'astech_google_sheet_config_v2',
  STOCKS_OVERRIDE_PREFIX: 'astech_stocks_override_',
  PRODUCTION_DATA: 'astech_production_data_v2',
  TALLY_OUTWARDS: 'astech_tally_outwards_v2',
  REGRIND_BALANCE: 'astech_regrind_balance_v2',
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

    // Default seeded initial report for 2026-10-01
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

    const initialSnapshot: DailyReportSnapshot = {
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
      notes: 'Production Blow & Injection report and store outwards reconciliation for Unit-1 & Unit-2.',
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
