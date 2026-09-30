/**
 * Astech Reconcile & Recycle Pro - Type Definitions
 */

export type UnitType = 'Unit-1' | 'Unit-2' | 'All';

export type MaterialCategory = 'Raw Material (RM)' | 'Masterbatch (MB)' | 'Filler MB (FMB)' | 'Other';

export type ReconciliationStatus = 'Match' | 'Mismatch' | 'Only in Tally' | 'Only in App' | 'Pending Review';

export interface ProductionItem {
  id: string;
  productName: string;
  colour: string;
  mbGrade: string;
  mbGrade2?: string;
  rm: string;
  fillerMbPercent: number;
  mbPercent: number;
  totalRmConsumption: number; // in kg
  mixingReturn: number; // in kg
  totalRejection: number; // in kg
  unit?: 'Unit-1' | 'Unit-2';
  date?: string;
  extraProps?: Record<string, any>;
}

export interface TallyOutwardItem {
  id: string;
  unit: 'Unit-1' | 'Unit-2';
  particulars: string;
  materialName: string;
  quantityKg: number;
  date: string;
}

export interface RegrindBalanceItem {
  id: string;
  skuName: string;
  color: string;
  recycleSource: string; // 'Production' | 'Store' | 'Dop' | 'Label' | 'Ptp' | string
  openingBalanceKg: number;
  periodProducedKg: number; // Regrind produced (crushed)
  periodConsumedKg: number; // Consumed / reused in mixing
  closingBalanceKg: number;
  balanceU1Kg: number;
  balanceU2Kg: number;
}

export interface SkuRegrindVsRejectionItem {
  id: string;
  skuName: string;
  color: string;
  recycleSource: string;
  regrindProducedKg: number;
  productionRejectionKg: number;
  crushedDeltaKg: number; // regrindProduced - productionRejection
  recoveryRatePercent: number; // (regrindProduced / productionRejection) * 100
  openingBalanceKg: number;
  periodConsumedKg: number;
  closingBalanceKg: number;
  balanceU1Kg: number;
  balanceU2Kg: number;
}

export interface ReconciliationRow {
  id: string;
  unit: 'Unit-1' | 'Unit-2';
  materialName: string;
  category: MaterialCategory;
  // Floor Stocks (Editable by user)
  openingStockKg: number;
  tallyOutwardKg: number;
  totalAvailableKg: number; // openingStockKg + tallyOutwardKg
  appConsumedKg: number; // from Apps mixing
  productionRmConsumptionKg: number; // from Production Excel
  mixingReturnKg: number; // Returned from mixing
  netProductionConsumedKg: number; // productionRmConsumptionKg - mixingReturnKg
  closingStockKg: number; // Editable by user
  calculatedClosingStockKg: number; // totalAvailable - appConsumed - mixingReturn
  varianceKg: number; // Discrepancy = (Opening + Tally - Mixing Return) - (Production/App + Closing)
  differenceAppTallyKg: number; // appConsumedKg - tallyOutwardKg
  status: ReconciliationStatus;
  tallyRawName: string;
  appRawName: string;
  notes?: string;
  updatedAt?: string;
}

export interface DailyReportSnapshot {
  id: string;
  date: string;
  unit: UnitType;
  title: string;
  savedAt: string;
  reconciliationRows: ReconciliationRow[];
  skuRegrindRows: SkuRegrindVsRejectionItem[];
  kpis: {
    totalTallyOutwardKg: number;
    totalAppConsumedKg: number;
    totalProductionRmKg: number;
    totalMixingReturnKg: number;
    totalOpeningStockKg: number;
    totalClosingStockKg: number;
    totalVarianceKg: number;
    matchCount: number;
    mismatchCount: number;
    totalRejectionKg: number;
    totalRegrindProducedKg: number;
    recoveryRatePercent: number;
  };
  notes?: string;
  syncedToGoogleSheet?: boolean;
  googleSheetSyncTime?: string;
}

export interface GoogleSheetConfig {
  webhookUrl: string;
  sheetUrl?: string;
  sheetName?: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}
