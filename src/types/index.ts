/**
 * Astech Reconcile & Recycle Pro - Type Definitions
 */

export type UnitType = 'Unit-1' | 'Unit-2' | 'All';

export type ProductionSection = 'All' | 'Blow' | 'Injection';

export type MaterialCategory = 'Raw Material (RM)' | 'Masterbatch (MB)' | 'Filler MB (FMB)' | 'Other';

export type ReconciliationStatus = 'Match' | 'Mismatch' | 'Only in Tally' | 'Only in App' | 'Pending Review';

export interface ProductionItem {
  id: string;
  productName: string; // Item Name
  itemName?: string; // explicit Item Name
  colour: string; // Color
  rmGrade?: string; // RM Grade (e.g. HDPE MARLEX Blow HHM5502 Q)
  rm: string; // RM
  mbGradeInner?: string; // MB Grade Inner
  mbGradeOuter?: string; // MB Grade Outer
  mbGrade: string; // MB Grade
  rmPercent?: number; // R/M %
  fillerMbPercent: number; // FMB %
  mbPercent: number; // MB %
  totalRmConsumption: number; // Material consumption (kg)
  mixingReturn: number; // Mixing Return (kg)
  totalRejection: number; // Rejection (kg) / Total Rejection (kg)
  unit?: 'Unit-1' | 'Unit-2';
  section?: 'Blow' | 'Injection' | 'Other'; // Production section: Blow vs Injection
  machineSerial?: string; // e.g. BM-U1-02, IBM-U1-01
  date?: string;
  extraProps?: Record<string, any>;
}

export interface TallyOutwardItem {
  id: string;
  unit: 'Unit-1' | 'Unit-2';
  particulars: string;
  materialName: string; // Material Name (RM, MB, FMB)
  quantityKg: number; // Tally Outward (Kg)
  appConsumedKg?: number; // App Consumed (Kg)
  date: string;
  status?: ReconciliationStatus;
}

export interface RegrindBalanceItem {
  id: string;
  skuName: string; // SKU Name
  color: string;
  recycleSource: string; // 'Production' | 'Store' | 'Dop' | 'Label' | 'Ptp' | string
  openingBalanceKg: number;
  periodProducedKg: number; // Period Produced (Kg) - Regrind crushed/produced
  periodConsumedKg: number; // Period Consumed (Kg) - reused in mixing
  closingBalanceKg: number;
  balanceU1Kg: number;
  balanceU2Kg: number;
}

export interface SkuRegrindVsRejectionItem {
  id: string;
  skuName: string; // SKU Name from Regrind Stock Report
  matchedItemName?: string; // Production Item Name matched (fuzzy / close)
  matchType?: 'exact' | 'close' | 'alias' | 'none';
  color: string;
  recycleSource: string;
  regrindProducedKg: number; // Regrind produced (crushed) from Period Produced (Kg)
  productionRejectionKg: number; // Total Rejection (Kg) from Production Rejection (kg)
  crushedDeltaKg: number; // regrindProduced - productionRejection
  recoveryRatePercent: number; // (regrindProduced / productionRejection) * 100
  openingBalanceKg: number;
  periodConsumedKg: number;
  closingBalanceKg: number;
  balanceU1Kg: number;
  balanceU2Kg: number;
  section?: 'Blow' | 'Injection' | 'Other' | 'All';
  rmGrade?: string;
  mbGradeInner?: string;
  mbGradeOuter?: string;
}

export interface ReconciliationRow {
  id: string;
  unit: 'Unit-1' | 'Unit-2';
  materialName: string; // Material Name (RM, MB, FMB)
  category: MaterialCategory;
  // Floor Stocks (Editable by user in report)
  openingStockKg: number;
  tallyOutwardKg: number; // Tally Outward (Kg)
  totalAvailableKg: number; // openingStockKg + tallyOutwardKg
  appConsumedKg: number; // App Consumed (Kg) from Apps mixing
  productionRmConsumptionKg: number; // from Production Excel
  mixingReturnKg: number; // Returned from mixing
  netProductionConsumedKg: number; // productionRmConsumptionKg - mixingReturnKg
  closingStockKg: number; // Editable by user
  calculatedClosingStockKg: number; // totalAvailable - appConsumed - mixingReturn
  varianceKg: number; // Discrepancy = (Opening + Tally - Mixing Return) - (Production/App + Closing)
  differenceAppTallyKg: number; // Difference (App - Tally)
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
  section?: ProductionSection;
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
