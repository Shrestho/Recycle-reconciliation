import Papa from 'papaparse';
import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  ReconciliationRow,
  MaterialCategory,
} from '../types';

/**
 * Normalizes text for matching and cleaning
 */
export function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/^["']|["']$/g, '');
}

/**
 * Normalizes numbers: removes commas, "KG", "nil", "-", spaces
 */
export function cleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/,/g, '').replace(/kg/gi, '').trim().toLowerCase();
  if (s === '' || s === '-' || s === 'nil' || s === 'null' || s === 'none') return 0;
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Categorizes material based on name patterns
 */
export function categorizeMaterial(name: string): MaterialCategory {
  const upper = name.toUpperCase();
  if (upper.includes('FILLER') || upper.includes('FMB') || upper.includes('GGR-115')) {
    return 'Filler MB (FMB)';
  }
  if (
    upper.includes('M.B') ||
    upper.includes('MB ') ||
    upper.includes('M/B') ||
    upper.includes('MASTER BATCH') ||
    upper.includes('C.M.B') ||
    upper.includes('ONCOLOR') ||
    upper.includes('SAM WHITE')
  ) {
    return 'Masterbatch (MB)';
  }
  if (
    upper.includes('PPCP') ||
    upper.includes('HDPE') ||
    upper.includes('LDPE') ||
    upper.includes('LLDPE') ||
    upper.includes('PP ') ||
    upper.includes('BE 961') ||
    upper.includes('AW564') ||
    upper.includes('RE420MO') ||
    upper.includes('ASPET') ||
    upper.includes('RESIN') ||
    upper.includes('MARLEX')
  ) {
    return 'Raw Material (RM)';
  }
  return 'Other';
}

/**
 * Parses Production RM Consumption & Rejection CSV (allows extra columns)
 */
export function parseProductionCsv(csvText: string, defaultUnit: 'Unit-1' | 'Unit-2' = 'Unit-1'): ProductionItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length < 2) return [];

  // Find header row (looks for "Product Name" or "RM Consumption" or "Total Rejection")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('product') || rowStr.includes('consumption') || rowStr.includes('rejection')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 0;
  const header = rows[headerIndex].map(c => cleanString(c).toLowerCase());

  // Helper to find column index by synonyms
  const getCol = (names: string[]): number => {
    return header.findIndex(h => names.some(n => h.includes(n.toLowerCase())));
  };

  const prodCol = getCol(['product name', 'product', 'item name', 'sku']);
  const colourCol = getCol(['colour', 'color']);
  const mbGradeCol = getCol(['mb grade', 'masterbatch', 'mb']);
  const rmCol = getCol(['rm', 'raw material', 'resin', 'grade']);
  const fillerMbCol = getCol(['filler mb %', 'filler mb', 'fmb %', 'filler %']);
  const mbCol = getCol(['mb %', 'mb percent']);
  const rmConsCol = getCol(['total rm consumption', 'rm consumption', 'consumption (kg)', 'consumption']);
  const mixRetCol = getCol(['mixing return', 'return(kg)', 'return']);
  const rejCol = getCol(['total rejection', 'rejection (kg)', 'rejection', 'reject']);
  const unitCol = getCol(['unit']);

  const parsedItems: ProductionItem[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const productName = prodCol !== -1 ? cleanString(row[prodCol]) : '';
    const colour = colourCol !== -1 ? cleanString(row[colourCol]) : '';
    const rm = rmCol !== -1 ? cleanString(row[rmCol]) : '';
    const mbGrade = mbGradeCol !== -1 ? cleanString(row[mbGradeCol]) : '';
    const totalRmConsumption = rmConsCol !== -1 ? cleanNumber(row[rmConsCol]) : 0;
    const mixingReturn = mixRetCol !== -1 ? cleanNumber(row[mixRetCol]) : 0;
    const totalRejection = rejCol !== -1 ? cleanNumber(row[rejCol]) : 0;
    const rowUnit = unitCol !== -1 && cleanString(row[unitCol]) ? (cleanString(row[unitCol]) as any) : defaultUnit;

    // Ignore completely empty rows or trailing summary rows
    if (!productName && !rm && totalRmConsumption === 0 && totalRejection === 0) {
      continue;
    }
    if (productName.toLowerCase().includes('total') || productName.toLowerCase().includes('grand total')) {
      continue;
    }

    parsedItems.push({
      id: `prod-${Date.now()}-${i}`,
      productName: productName || 'Unnamed SKU',
      colour,
      mbGrade,
      rm,
      fillerMbPercent: fillerMbCol !== -1 ? cleanNumber(row[fillerMbCol]) : 0,
      mbPercent: mbCol !== -1 ? cleanNumber(row[mbCol]) : 0,
      totalRmConsumption,
      mixingReturn,
      totalRejection,
      unit: rowUnit,
    });
  }

  return parsedItems;
}

/**
 * Parses Tally ERP Godown Summary Outward CSV/TXT
 */
export function parseTallyOutwardsCsv(csvText: string, dateStr: string = '2026-09-24'): TallyOutwardItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length === 0) return [];

  // Detect Unit from top header if present (e.g., "RM Unit-1" or "RM Unit-2")
  let detectedUnit: 'Unit-1' | 'Unit-2' = 'Unit-1';
  let dateDetected = dateStr;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].join(' ');
    if (/Unit-2/i.test(rowStr) || /Unit 2/i.test(rowStr)) {
      detectedUnit = 'Unit-2';
    } else if (/Unit-1/i.test(rowStr) || /Unit 1/i.test(rowStr)) {
      detectedUnit = 'Unit-1';
    }
    const dateMatch = rowStr.match(/(\d{1,2}-[a-zA-Z]{3}-\d{2,4})/);
    if (dateMatch) {
      dateDetected = dateMatch[1];
    }
  }

  // Find header row with "Particulars"
  let particularsCol = -1;
  let qtyCol = -1;
  let headerIndex = -1;

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    for (let c = 0; c < row.length; c++) {
      const val = cleanString(row[c]).toLowerCase();
      if (val.includes('particulars')) {
        headerIndex = i;
        particularsCol = c;
      }
      if (val.includes('quantity') || val.includes('outward') || val.includes('kg')) {
        qtyCol = c;
      }
    }
    if (particularsCol !== -1) break;
  }

  // If no particulars header found, assume col 0 is material and col 1 or 2 is quantity
  if (particularsCol === -1) {
    particularsCol = 0;
    qtyCol = 1;
    headerIndex = 0;
  } else if (qtyCol === -1) {
    qtyCol = particularsCol + 1;
  }

  const items: TallyOutwardItem[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawParticulars = cleanString(row[particularsCol]);
    if (!rawParticulars) continue;

    const lower = rawParticulars.toLowerCase();
    if (
      lower.includes('grand total') ||
      lower.includes('particulars') ||
      lower.includes('godown summary') ||
      lower.includes('inventory')
    ) {
      continue;
    }

    // Check quantity across potential quantity columns
    let qty = 0;
    if (qtyCol !== -1 && row[qtyCol] !== undefined) {
      qty = cleanNumber(row[qtyCol]);
    }
    if (qty === 0 && row[particularsCol + 1] !== undefined) {
      qty = cleanNumber(row[particularsCol + 1]);
    }

    items.push({
      id: `tally-${detectedUnit}-${Date.now()}-${i}`,
      unit: detectedUnit,
      particulars: rawParticulars,
      materialName: rawParticulars,
      quantityKg: qty,
      date: dateDetected,
    });
  }

  return items;
}

/**
 * Parses SKU Wise Regrind Balance CSV
 */
export function parseRegrindBalanceCsv(csvText: string): RegrindBalanceItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length < 2) return [];

  // Find header row with "SKU Name"
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map(c => cleanString(c).toLowerCase()).join(' ');
    if (rowStr.includes('sku name') || rowStr.includes('period produced') || rowStr.includes('regrind')) {
      headerIndex = i;
      break;
    }
  }

  const header = rows[headerIndex].map(c => cleanString(c).toLowerCase());
  const getCol = (names: string[]): number => header.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

  const skuCol = getCol(['sku name', 'sku', 'product']);
  const colorCol = getCol(['color', 'colour']);
  const srcCol = getCol(['recycle source', 'source']);
  const openCol = getCol(['opening balance', 'opening']);
  const prodCol = getCol(['period produced', 'produced']);
  const consCol = getCol(['period consumed', 'consumed']);
  const closeCol = getCol(['closing balance', 'closing']);
  const u1Col = getCol(['balance u-1', 'u-1', 'unit-1']);
  const u2Col = getCol(['balance u-2', 'u-2', 'unit-2']);

  const items: RegrindBalanceItem[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const skuName = skuCol !== -1 ? cleanString(row[skuCol]) : '';
    if (!skuName || skuName.toLowerCase() === 'total' || skuName.toLowerCase() === 'grand total') {
      continue;
    }

    items.push({
      id: `rg-${Date.now()}-${i}`,
      skuName,
      color: colorCol !== -1 ? cleanString(row[colorCol]) : '',
      recycleSource: srcCol !== -1 ? cleanString(row[srcCol]) : 'Production',
      openingBalanceKg: openCol !== -1 ? cleanNumber(row[openCol]) : 0,
      periodProducedKg: prodCol !== -1 ? cleanNumber(row[prodCol]) : 0,
      periodConsumedKg: consCol !== -1 ? cleanNumber(row[consCol]) : 0,
      closingBalanceKg: closeCol !== -1 ? cleanNumber(row[closeCol]) : 0,
      balanceU1Kg: u1Col !== -1 ? cleanNumber(row[u1Col]) : 0,
      balanceU2Kg: u2Col !== -1 ? cleanNumber(row[u2Col]) : 0,
    });
  }

  return items;
}
