import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  SkuRegrindVsRejectionItem,
  ReconciliationRow,
  ReconciliationStatus,
} from '../types';
import { categorizeMaterial } from './csvParser';

/**
 * Normalizes strings for loose matching (strips non-alphanumeric, lowercases)
 */
export function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Builds the SKU Wise Regrind Produced vs Production Rejection comparison
 */
export function computeSkuRegrindVsRejection(
  regrindItems: RegrindBalanceItem[],
  productionItems: ProductionItem[]
): SkuRegrindVsRejectionItem[] {
  // Aggregate production rejections by normalized SKU + color
  const rejectionMap = new Map<string, { totalRejection: number; rawName: string; color: string }>();

  productionItems.forEach(item => {
    const key = `${normalizeKey(item.productName)}_${normalizeKey(item.colour)}`;
    const existing = rejectionMap.get(key) || {
      totalRejection: 0,
      rawName: item.productName,
      color: item.colour,
    };
    existing.totalRejection += item.totalRejection;
    rejectionMap.set(key, existing);

    // Also index just by product name in case color was omitted or varies
    const nameOnlyKey = normalizeKey(item.productName);
    if (!rejectionMap.has(nameOnlyKey)) {
      rejectionMap.set(nameOnlyKey, {
        totalRejection: item.totalRejection,
        rawName: item.productName,
        color: item.colour,
      });
    }
  });

  const matchedKeys = new Set<string>();
  const rows: SkuRegrindVsRejectionItem[] = [];

  // Match existing regrind balance items with production rejection
  regrindItems.forEach(rg => {
    const fullKey = `${normalizeKey(rg.skuName)}_${normalizeKey(rg.color)}`;
    const nameKey = normalizeKey(rg.skuName);

    let rejInfo = rejectionMap.get(fullKey);
    if (!rejInfo) {
      rejInfo = rejectionMap.get(nameKey);
    }

    const prodRejection = rejInfo ? rejInfo.totalRejection : 0;
    if (rejInfo) {
      matchedKeys.add(fullKey);
      matchedKeys.add(nameKey);
    }

    const crushedDelta = rg.periodProducedKg - prodRejection;
    const recoveryRate =
      prodRejection > 0
        ? (rg.periodProducedKg / prodRejection) * 100
        : rg.periodProducedKg > 0
        ? 100
        : 0;

    rows.push({
      id: `sku-comp-${rg.id}`,
      skuName: rg.skuName,
      color: rg.color || 'Standard',
      recycleSource: rg.recycleSource,
      regrindProducedKg: rg.periodProducedKg,
      productionRejectionKg: Number(prodRejection.toFixed(3)),
      crushedDeltaKg: Number(crushedDelta.toFixed(3)),
      recoveryRatePercent: Number(recoveryRate.toFixed(1)),
      openingBalanceKg: rg.openingBalanceKg,
      periodConsumedKg: rg.periodConsumedKg,
      closingBalanceKg: rg.closingBalanceKg,
      balanceU1Kg: rg.balanceU1Kg,
      balanceU2Kg: rg.balanceU2Kg,
    });
  });

  // Add any production items that had rejections but were not in regrind balance sheet
  productionItems.forEach(prod => {
    if (prod.totalRejection <= 0) return;
    const fullKey = `${normalizeKey(prod.productName)}_${normalizeKey(prod.colour)}`;
    const nameKey = normalizeKey(prod.productName);

    if (!matchedKeys.has(fullKey) && !matchedKeys.has(nameKey)) {
      matchedKeys.add(fullKey);
      matchedKeys.add(nameKey);

      rows.push({
        id: `sku-comp-unmatched-${prod.id}`,
        skuName: prod.productName,
        color: prod.colour || 'Standard',
        recycleSource: 'Production',
        regrindProducedKg: 0,
        productionRejectionKg: Number(prod.totalRejection.toFixed(3)),
        crushedDeltaKg: Number((-prod.totalRejection).toFixed(3)),
        recoveryRatePercent: 0,
        openingBalanceKg: 0,
        periodConsumedKg: 0,
        closingBalanceKg: 0,
        balanceU1Kg: 0,
        balanceU2Kg: 0,
      });
    }
  });

  // Sort by highest rejection/production
  return rows.sort((a, b) => b.productionRejectionKg - a.productionRejectionKg);
}

/**
 * Computes Tally Reconciliation Rows with Opening and Closing stock in mixing
 */
export function computeReconciliationRows(
  tallyOutwards: TallyOutwardItem[],
  productionItems: ProductionItem[],
  customStocks: Record<string, { opening: number; closing: number; notes?: string }> = {}
): ReconciliationRow[] {
  // Aggregate Tally Outwards by Unit + Material
  const tallyMap = new Map<string, { qty: number; rawName: string; unit: 'Unit-1' | 'Unit-2' }>();

  tallyOutwards.forEach(t => {
    const key = `${t.unit}_${normalizeKey(t.materialName)}`;
    const cur = tallyMap.get(key) || { qty: 0, rawName: t.materialName, unit: t.unit };
    cur.qty += t.quantityKg;
    tallyMap.set(key, cur);
  });

  // Aggregate Production RM consumption & MB consumption by Unit + Material
  const prodMap = new Map<string, { qty: number; returnQty: number; rawName: string; unit: 'Unit-1' | 'Unit-2' }>();

  productionItems.forEach(p => {
    const unit = p.unit || 'Unit-1';

    // 1. Raw Material
    if (p.rm) {
      const rmKey = `${unit}_${normalizeKey(p.rm)}`;
      const cur = prodMap.get(rmKey) || { qty: 0, returnQty: 0, rawName: p.rm, unit };
      cur.qty += p.totalRmConsumption;
      cur.returnQty += p.mixingReturn;
      prodMap.set(rmKey, cur);
    }

    // 2. Masterbatch Grade
    if (p.mbGrade) {
      const mbKey = `${unit}_${normalizeKey(p.mbGrade)}`;
      const cur = prodMap.get(mbKey) || { qty: 0, returnQty: 0, rawName: p.mbGrade, unit };
      // MB consumption is approx (mbPercent / 100) * totalRmConsumption if not logged separately
      const mbKg = p.mbPercent > 0 ? (p.totalRmConsumption * p.mbPercent) / 100 : 0;
      cur.qty += mbKg;
      prodMap.set(mbKey, cur);
    }
  });

  // Combine unique keys
  const allKeys = new Set<string>([...tallyMap.keys(), ...prodMap.keys()]);
  const rows: ReconciliationRow[] = [];

  allKeys.forEach(key => {
    const tallyInfo = tallyMap.get(key);
    const prodInfo = prodMap.get(key);

    const unit: 'Unit-1' | 'Unit-2' = tallyInfo?.unit || prodInfo?.unit || 'Unit-1';
    const rawMaterialName = tallyInfo?.rawName || prodInfo?.rawName || 'Unknown Material';
    const tallyOutwardKg = Number((tallyInfo?.qty || 0).toFixed(2));
    const productionRmConsumptionKg = Number((prodInfo?.qty || 0).toFixed(2));
    const mixingReturnKg = Number((prodInfo?.returnQty || 0).toFixed(2));

    // Custom user input opening and closing stock (or defaults)
    const custom = customStocks[`${unit}_${rawMaterialName}`] || {
      opening: 0,
      closing: 0,
    };

    const openingStockKg = custom.opening;
    const totalAvailableKg = Number((openingStockKg + tallyOutwardKg).toFixed(2));

    // Apps mixing consumption: if present in custom or defaults to productionRmConsumption
    const appConsumedKg = productionRmConsumptionKg;
    const netProductionConsumedKg = Number((productionRmConsumptionKg - mixingReturnKg).toFixed(2));

    const calculatedClosingStockKg = Number(
      Math.max(0, totalAvailableKg - appConsumedKg - mixingReturnKg).toFixed(2)
    );

    const closingStockKg = custom.closing > 0 ? custom.closing : calculatedClosingStockKg;

    // Discrepancy / Variance
    // Variance = (Opening + Tally - Mixing Return) - (Production Consumption + Closing)
    const varianceKg = Number(
      (openingStockKg + tallyOutwardKg - mixingReturnKg - (productionRmConsumptionKg + closingStockKg)).toFixed(2)
    );
    const diffAppTally = Number((appConsumedKg - tallyOutwardKg).toFixed(2));

    // Determine status
    let status: ReconciliationStatus = 'Match';
    if (tallyOutwardKg > 0 && appConsumedKg === 0) {
      status = 'Only in Tally';
    } else if (tallyOutwardKg === 0 && appConsumedKg > 0) {
      status = 'Only in App';
    } else if (Math.abs(diffAppTally) > 0.05 || Math.abs(varianceKg) > 0.5) {
      status = 'Mismatch';
    }

    rows.push({
      id: `rec-${unit}-${normalizeKey(rawMaterialName)}`,
      unit,
      materialName: rawMaterialName,
      category: categorizeMaterial(rawMaterialName),
      openingStockKg,
      tallyOutwardKg,
      totalAvailableKg,
      appConsumedKg,
      productionRmConsumptionKg,
      mixingReturnKg,
      netProductionConsumedKg,
      closingStockKg,
      calculatedClosingStockKg,
      varianceKg,
      differenceAppTallyKg: diffAppTally,
      status,
      tallyRawName: tallyInfo ? tallyInfo.rawName : '',
      appRawName: prodInfo ? prodInfo.rawName : '',
      notes: custom.notes || '',
    });
  });

  // Sort: Mismatches and Only items first, then largest Tally outwards
  return rows.sort((a, b) => {
    if (a.status === 'Mismatch' && b.status !== 'Mismatch') return -1;
    if (a.status !== 'Mismatch' && b.status === 'Mismatch') return 1;
    return b.tallyOutwardKg - a.tallyOutwardKg;
  });
}
