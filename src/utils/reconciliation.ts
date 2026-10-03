import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  SkuRegrindVsRejectionItem,
  ReconciliationRow,
  ReconciliationStatus,
  ProductionSection,
} from '../types';
import { categorizeMaterial } from './csvParser';

/**
 * Normalizes strings for matching (strips non-alphanumeric, lowercases)
 */
export function normalizeKey(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Normalizes tokens for smart fuzzy matching between Production Item Name and Regrind SKU Name
 */
function extractCoreTokens(name: string): string[] {
  if (!name) return [];
  const normalized = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // remove parentheses content like (With Rachet), (Tall Shape)
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    'bottle', 'btl', 'body', 'cap', 'jar', 'lid', 'with', 'rachet', 'shape', 'tall', 'olive',
    '1st', '2nd', 'first', 'second', 'run', 'men', 'gm', 'g', 'ml', 'ltr', 'l', 'mm', 'for', 'the',
    'of', 'lotion', 'shampoo', 'wash', 'sfg', 'fg', 'type', 'thread', 'ft'
  ]);

  return normalized
    .split(' ')
    .filter(t => t.length > 0 && !stopWords.has(t));
}

/**
 * Normalizes colors to handle variations like "Pearl white" <-> "White", "Purpul" <-> "Purple"
 */
function normalizeColor(color: string): string {
  const c = (color || '').toLowerCase().trim();
  if (c.includes('white')) return 'white';
  if (c.includes('purp')) return 'purple';
  if (c.includes('blue')) return 'blue';
  if (c.includes('green')) return 'green';
  if (c.includes('orange') || c.includes('orrange')) return 'orange';
  if (c.includes('yellow')) return 'yellow';
  if (c.includes('pink')) return 'pink';
  if (c.includes('black')) return 'black';
  if (c.includes('natural') || c.includes('translu') || c.includes('naturel')) return 'natural';
  return c;
}

/**
 * Computes fuzzy / alias similarity between a Production Item Name and a Regrind SKU Name
 */
export function isAlmostCloseMatch(
  prodName: string,
  prodColor: string,
  skuName: string,
  skuColor: string
): { isMatch: boolean; confidence: number; matchType: 'exact' | 'close' | 'alias' } {
  const normProd = normalizeKey(prodName);
  const normSku = normalizeKey(skuName);

  // 1. Exact normalized name match
  if (normProd === normSku) {
    return { isMatch: true, confidence: 100, matchType: 'exact' };
  }

  // 2. Substring match
  if (normProd.includes(normSku) || normSku.includes(normProd)) {
    return { isMatch: true, confidence: 95, matchType: 'exact' };
  }

  // 3. Known Factory Nicknames & Aliases
  const aliasPairs: [string, string][] = [
    ['pdnt100', 'btlpdnt100'],
    ['pdnt50', 'btlpdnt50'],
    ['khaleesi', 'khalessi'],
    ['lifebuoy', 'lbhw'],
    ['vasline400', 'vtm400'],
    ['vasline400', 'vaseline400'],
    ['ponds100', 'ponds100'],
    ['ponds200', 'ponds200'],
    ['dettol5', '5ltrdettol'],
    ['vim1', 'vim1'],
    ['courage', 'courage'],
    ['elimate60', 'elimate60'],
    ['pwb25', 'pwb25'],
    ['vpj50', '50gmpvc'],
    ['sunsilk650', 'sunsilk650'],
    ['rin800', 'rin800'],
  ];

  for (const [a1, a2] of aliasPairs) {
    if (
      (normProd.includes(a1) && normSku.includes(a2)) ||
      (normProd.includes(a2) && normSku.includes(a1))
    ) {
      return { isMatch: true, confidence: 90, matchType: 'alias' };
    }
  }

  // 4. Token-level overlap (e.g. "PDNT" and "100", or "Harpic" and "500")
  const prodTokens = extractCoreTokens(prodName);
  const skuTokens = extractCoreTokens(skuName);

  if (prodTokens.length > 0 && skuTokens.length > 0) {
    const intersection = prodTokens.filter(t => skuTokens.includes(t));
    const tokenScore = (intersection.length * 2) / (prodTokens.length + skuTokens.length);

    // If matching at least 2 key tokens or 1 unique brand token (e.g., 'harpic', 'hexisol', 'dove', 'believe')
    const keyBrands = ['harpic', 'hexisol', 'dove', 'believe', 'pdnt', 'ponds', 'sunsilk', 'elimate', 'vim', 'dettol', 'khaleesi', 'khalessi', 'courage', 'rin', 'viscotin'];
    const matchedBrand = intersection.find(t => keyBrands.includes(t));

    if (tokenScore >= 0.5 || (matchedBrand && intersection.length >= 1)) {
      // Check colors compatibility if colors are provided
      const c1 = normalizeColor(prodColor);
      const c2 = normalizeColor(skuColor);
      const colorMatch = !c1 || !c2 || c1 === c2;

      if (colorMatch || tokenScore >= 0.7) {
        return { isMatch: true, confidence: Math.round(tokenScore * 100), matchType: 'close' };
      }
    }
  }

  return { isMatch: false, confidence: 0, matchType: 'exact' };
}

/**
 * Builds the SKU Wise Regrind Produced vs Production Rejection comparison
 * Comparing:
 * - Production: "Item Name" -> "Rejection (kg)" / "Total Rejection (kg)"
 * - Regrind Stock Report: "SKU Name" -> "Period Produced (Kg)"
 */
export function computeSkuRegrindVsRejection(
  regrindItems: RegrindBalanceItem[],
  productionItems: ProductionItem[],
  sectionFilter: ProductionSection = 'All'
): SkuRegrindVsRejectionItem[] {
  // Filter production items by section if specified
  const filteredProd = productionItems.filter(p => {
    if (sectionFilter === 'All') return true;
    return p.section === sectionFilter;
  });

  const matchedProdIds = new Set<string>();
  const rows: SkuRegrindVsRejectionItem[] = [];

  // Match each Regrind balance item with production items
  regrindItems.forEach(rg => {
    let matchedProdItem: ProductionItem | null = null;
    let matchedRejection = 0;
    let bestMatchInfo: { isMatch: boolean; confidence: number; matchType: 'exact' | 'close' | 'alias' } = {
      isMatch: false,
      confidence: 0,
      matchType: 'exact',
    };

    filteredProd.forEach(prod => {
      const match = isAlmostCloseMatch(prod.productName, prod.colour, rg.skuName, rg.color);
      if (match.isMatch && match.confidence > bestMatchInfo.confidence) {
        bestMatchInfo = match;
        matchedProdItem = prod;
      }
    });

    // If matched, sum rejection for all production runs of this product
    if (matchedProdItem) {
      filteredProd.forEach(prod => {
        const m = isAlmostCloseMatch(prod.productName, prod.colour, rg.skuName, rg.color);
        if (m.isMatch) {
          matchedRejection += prod.totalRejection;
          matchedProdIds.add(prod.id);
        }
      });
    }

    const regrindProduced = rg.periodProducedKg;
    const prodRejection = Number(matchedRejection.toFixed(3));
    const crushedDelta = Number((regrindProduced - prodRejection).toFixed(3));
    const recoveryRate =
      prodRejection > 0
        ? Number(((regrindProduced / prodRejection) * 100).toFixed(1))
        : regrindProduced > 0
        ? 100
        : 0;

    rows.push({
      id: `sku-comp-${rg.id}`,
      skuName: rg.skuName,
      matchedItemName: (matchedProdItem as ProductionItem | null)?.productName,
      matchType: bestMatchInfo.matchType,
      color: rg.color || 'Standard',
      recycleSource: rg.recycleSource,
      regrindProducedKg: regrindProduced,
      productionRejectionKg: prodRejection,
      crushedDeltaKg: crushedDelta,
      recoveryRatePercent: recoveryRate,
      openingBalanceKg: rg.openingBalanceKg,
      periodConsumedKg: rg.periodConsumedKg,
      closingBalanceKg: rg.closingBalanceKg,
      balanceU1Kg: rg.balanceU1Kg,
      balanceU2Kg: rg.balanceU2Kg,
      section: (matchedProdItem as ProductionItem | null)?.section,
      rmGrade: (matchedProdItem as ProductionItem | null)?.rmGrade,
      mbGradeInner: (matchedProdItem as ProductionItem | null)?.mbGradeInner,
      mbGradeOuter: (matchedProdItem as ProductionItem | null)?.mbGradeOuter,
    });
  });

  // Add any production items that had rejections but were not matched to the regrind stock report
  filteredProd.forEach(prod => {
    if (prod.totalRejection <= 0 || matchedProdIds.has(prod.id)) return;
    matchedProdIds.add(prod.id);

    rows.push({
      id: `sku-comp-unmatched-${prod.id}`,
      skuName: prod.productName,
      matchedItemName: prod.productName,
      matchType: 'none',
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
      section: prod.section,
      rmGrade: prod.rmGrade,
      mbGradeInner: prod.mbGradeInner,
      mbGradeOuter: prod.mbGradeOuter,
    });
  });

  // Sort by highest rejection / activity
  return rows.sort((a, b) => b.productionRejectionKg - a.productionRejectionKg);
}

/**
 * Computes Tally Reconciliation Rows with Opening and Closing stock in mixing
 * Material Name = RM, MB, FMB name
 * Tally Outward (Kg) = Tally software issue to mixing
 * App Consumed (Kg) = Apps mixing consumed
 */
export function computeReconciliationRows(
  tallyOutwards: TallyOutwardItem[],
  productionItems: ProductionItem[],
  customStocks: Record<string, { opening: number; closing: number; notes?: string }> = {}
): ReconciliationRow[] {
  // Aggregate Tally Outwards by Unit + Material
  const tallyMap = new Map<string, { tallyQty: number; appQty: number; rawName: string; unit: 'Unit-1' | 'Unit-2'; status?: ReconciliationStatus }>();

  tallyOutwards.forEach(t => {
    const key = `${t.unit}_${normalizeKey(t.materialName)}`;
    const cur = tallyMap.get(key) || { tallyQty: 0, appQty: 0, rawName: t.materialName, unit: t.unit, status: t.status };
    cur.tallyQty += t.quantityKg;
    if (t.appConsumedKg !== undefined && t.appConsumedKg > 0) {
      cur.appQty += t.appConsumedKg;
    }
    if (t.status) cur.status = t.status;
    tallyMap.set(key, cur);
  });

  // Aggregate Production RM consumption & MB consumption by Unit + Material
  const prodMap = new Map<string, { qty: number; returnQty: number; rawName: string; unit: 'Unit-1' | 'Unit-2' }>();

  productionItems.forEach(p => {
    const unit = p.unit || 'Unit-1';

    // 1. Raw Material (RM Grade)
    const rmName = p.rmGrade || p.rm;
    if (rmName) {
      const rmKey = `${unit}_${normalizeKey(rmName)}`;
      const cur = prodMap.get(rmKey) || { qty: 0, returnQty: 0, rawName: rmName, unit };
      cur.qty += p.totalRmConsumption;
      cur.returnQty += p.mixingReturn;
      prodMap.set(rmKey, cur);
    }

    // 2. Masterbatch Grade Inner
    if (p.mbGradeInner) {
      const mbKey = `${unit}_${normalizeKey(p.mbGradeInner)}`;
      const cur = prodMap.get(mbKey) || { qty: 0, returnQty: 0, rawName: p.mbGradeInner, unit };
      const mbKg = p.mbPercent > 0 ? (p.totalRmConsumption * p.mbPercent) / 100 : 0;
      cur.qty += mbKg;
      prodMap.set(mbKey, cur);
    }

    // 3. Masterbatch Grade Outer
    if (p.mbGradeOuter && p.mbGradeOuter !== p.mbGradeInner) {
      const mbKey = `${unit}_${normalizeKey(p.mbGradeOuter)}`;
      const cur = prodMap.get(mbKey) || { qty: 0, returnQty: 0, rawName: p.mbGradeOuter, unit };
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
    const tallyOutwardKg = Number((tallyInfo?.tallyQty || 0).toFixed(2));
    const productionRmConsumptionKg = Number((prodInfo?.qty || 0).toFixed(2));
    const mixingReturnKg = Number((prodInfo?.returnQty || 0).toFixed(2));

    // Custom user input opening and closing stock (or defaults)
    const custom = customStocks[`${unit}_${rawMaterialName}`] || {
      opening: 0,
      closing: 0,
    };

    const openingStockKg = custom.opening;
    const totalAvailableKg = Number((openingStockKg + tallyOutwardKg).toFixed(2));

    // Apps mixing consumption: use tally file appConsumed if available, else productionRmConsumption
    const appConsumedKg = tallyInfo?.appQty && tallyInfo.appQty > 0
      ? Number(tallyInfo.appQty.toFixed(2))
      : productionRmConsumptionKg;

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

    // Determine status (use file status if provided, or calculate)
    let status: ReconciliationStatus = tallyInfo?.status || 'Match';
    if (!tallyInfo?.status) {
      if (tallyOutwardKg > 0 && appConsumedKg === 0) {
        status = 'Only in Tally';
      } else if (tallyOutwardKg === 0 && appConsumedKg > 0) {
        status = 'Only in App';
      } else if (Math.abs(diffAppTally) > 0.05 || Math.abs(varianceKg) > 0.5) {
        status = 'Mismatch';
      } else {
        status = 'Match';
      }
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
