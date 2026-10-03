import Papa from 'papaparse';
import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  MaterialCategory,
} from '../types';

/**
 * Normalizes text for matching and cleaning
 */
export function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\r\n|\r|\n/g, ' ');
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
  if (upper.includes('FILLER') || upper.includes('FMB') || upper.includes('GGR-115') || upper.includes('SODIUM FILLER')) {
    return 'Filler MB (FMB)';
  }
  if (
    upper.includes('M.B') ||
    upper.includes('MB ') ||
    upper.includes('M/B') ||
    upper.includes('MASTER BATCH') ||
    upper.includes('MASTERBATCH') ||
    upper.includes('C.M.B') ||
    upper.includes('ONCOLOR') ||
    upper.includes('SAM WHITE') ||
    upper.includes('WHITE CP') ||
    upper.includes('CP-')
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
    upper.includes('RE 420') ||
    upper.includes('ASPET') ||
    upper.includes('RESIN') ||
    upper.includes('MARLEX') ||
    upper.includes('REPOL')
  ) {
    return 'Raw Material (RM)';
  }
  return 'Other';
}

/**
 * Parses Production Blow / Injection CSV (tolerant to header rows and extra columns)
 */
export function parseProductionCsv(csvText: string, defaultUnit: 'Unit-1' | 'Unit-2' = 'Unit-1'): ProductionItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length < 2) return [];

  // Find header row (looks for "Item Name" or "Product Name" or "RM Grade" or "Rejection")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowStr = rows[i].map(c => cleanString(c).toLowerCase()).join(' ');
    if (
      (rowStr.includes('item name') || rowStr.includes('product name') || rowStr.includes('item')) &&
      (rowStr.includes('rm') || rowStr.includes('grade') || rowStr.includes('rejection') || rowStr.includes('m/c'))
    ) {
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

  const itemCol = getCol(['item name', 'product name', 'product', 'item', 'sku']);
  const colourCol = getCol(['color', 'colour']);
  const mcSerialCol = getCol(['new m/c serial no.', 'm/c serial', 'mc serial', 'serial no', 'machine']);
  const rmGradeCol = getCol(['rm grade', 'rm\ngrade', 'rm', 'raw material']);
  const mbInnerCol = getCol(['mb grade inner', 'mb\ngrade inner', 'inner mb', 'mb inner']);
  const mbOuterCol = getCol(['mb grade outer', 'mb\ngrade outer', 'outer mb', 'mb outer']);
  const mbGradeCol = getCol(['mb grade', 'mb\ngrade', 'masterbatch']);
  const rmPercentCol = getCol(['r/m %', 'rm %', 'rm percent']);
  const fmbPercentCol = getCol(['fmb %', 'filler mb %', 'filler %']);
  const mbPercentCol = getCol(['mb %', 'mb percent']);
  const rejCol = getCol(['rejection (kg)', 'total rejection (kg)', 'total rej', 'rejection']);
  const matConsCol = getCol(['material consumption (kg)', 'total rm consumption', 'consumption (kg)', 'consumption']);
  const mixRetCol = getCol(['mixing return (kg)', 'mixing return', 'return']);
  const unitCol = getCol(['unit']);

  const parsedItems: ProductionItem[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const itemName = itemCol !== -1 ? cleanString(row[itemCol]) : '';
    const colour = colourCol !== -1 ? cleanString(row[colourCol]) : '';
    const mcSerial = mcSerialCol !== -1 ? cleanString(row[mcSerialCol]) : '';
    const rmGrade = rmGradeCol !== -1 ? cleanString(row[rmGradeCol]) : '';
    const mbInner = mbInnerCol !== -1 ? cleanString(row[mbInnerCol]) : '';
    const mbOuter = mbOuterCol !== -1 ? cleanString(row[mbOuterCol]) : '';
    const mbGrade = mbGradeCol !== -1 ? cleanString(row[mbGradeCol]) : mbInner || mbOuter;
    const rmPercent = rmPercentCol !== -1 ? cleanNumber(row[rmPercentCol]) : 0;
    const fmbPercent = fmbPercentCol !== -1 ? cleanNumber(row[fmbPercentCol]) : 0;
    const mbPercent = mbPercentCol !== -1 ? cleanNumber(row[mbPercentCol]) : 0;
    const totalRejection = rejCol !== -1 ? cleanNumber(row[rejCol]) : 0;
    const totalRmConsumption = matConsCol !== -1 ? cleanNumber(row[matConsCol]) : 0;
    const mixingReturn = mixRetCol !== -1 ? cleanNumber(row[mixRetCol]) : 0;

    // Detect unit from machine code or row (e.g. BM-U1-01 -> Unit-1, BM-U2-11 -> Unit-2)
    let detectedUnit = defaultUnit;
    if (mcSerial.toUpperCase().includes('U1')) {
      detectedUnit = 'Unit-1';
    } else if (mcSerial.toUpperCase().includes('U2')) {
      detectedUnit = 'Unit-2';
    } else if (unitCol !== -1 && cleanString(row[unitCol])) {
      const uStr = cleanString(row[unitCol]);
      if (/Unit-2/i.test(uStr) || /Unit 2/i.test(uStr)) detectedUnit = 'Unit-2';
      else if (/Unit-1/i.test(uStr) || /Unit 1/i.test(uStr)) detectedUnit = 'Unit-1';
    }

    // Detect section: Blow vs Injection
    let section: 'Blow' | 'Injection' | 'Other' = 'Blow';
    const mcUpper = mcSerial.toUpperCase();
    if (mcUpper.includes('IBM') || mcUpper.includes('INJ') || itemName.toLowerCase().includes('cap') || itemName.toLowerCase().includes('lid')) {
      section = 'Injection';
    } else if (mcUpper.includes('BM') || itemName.toLowerCase().includes('bottle') || itemName.toLowerCase().includes('jar')) {
      section = 'Blow';
    }

    // Skip empty or summary rows
    if (!itemName && !rmGrade && totalRejection === 0 && totalRmConsumption === 0) {
      continue;
    }
    if (itemName.toLowerCase().includes('total') || itemName.toLowerCase().includes('grand total') || itemName.toLowerCase() === 'no mold') {
      continue;
    }

    parsedItems.push({
      id: `prod-${Date.now()}-${i}`,
      productName: itemName || 'Unnamed Item',
      itemName: itemName || 'Unnamed Item',
      colour: colour || 'Standard',
      machineSerial: mcSerial,
      rmGrade: rmGrade || 'Standard RM',
      rm: rmGrade || 'Standard RM',
      mbGradeInner: mbInner,
      mbGradeOuter: mbOuter,
      mbGrade: mbGrade || mbInner || mbOuter || '',
      rmPercent,
      fillerMbPercent: fmbPercent,
      mbPercent,
      totalRmConsumption,
      mixingReturn,
      totalRejection,
      unit: detectedUnit,
      section,
    });
  }

  return parsedItems;
}

/**
 * Parses Tally ERP Reconciliation CSV or Godown Summary CSV/TXT
 */
export function parseTallyOutwardsCsv(csvText: string, dateStr: string = '2026-10-01'): TallyOutwardItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length === 0) return [];

  // Check if this is the structured Reconciliation Report file
  // (Unit, Material Name, Tally Outward (Kg), App Consumed (Kg), Difference (App - Tally), Status...)
  let isReconciliationFormat = false;
  let headerIndex = -1;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map(c => cleanString(c).toLowerCase()).join(' ');
    if (rowStr.includes('material name') && (rowStr.includes('tally outward') || rowStr.includes('outward'))) {
      isReconciliationFormat = true;
      headerIndex = i;
      break;
    }
  }

  if (isReconciliationFormat) {
    const header = rows[headerIndex].map(c => cleanString(c).toLowerCase());
    const getCol = (names: string[]): number => header.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

    const unitCol = getCol(['unit']);
    const matCol = getCol(['material name', 'material']);
    const outwardCol = getCol(['tally outward (kg)', 'tally outward', 'outward (kg)', 'outward']);
    const appCol = getCol(['app consumed (kg)', 'app consumed', 'consumed (kg)', 'consumed']);
    const statusCol = getCol(['status']);

    const items: TallyOutwardItem[] = [];

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const matName = matCol !== -1 ? cleanString(row[matCol]) : '';
      if (!matName || matName.toLowerCase().includes('grand total') || matName.toLowerCase() === 'total') {
        continue;
      }

      let unit: 'Unit-1' | 'Unit-2' = 'Unit-1';
      if (unitCol !== -1) {
        const u = cleanString(row[unitCol]);
        if (/Unit-2/i.test(u) || /Unit 2/i.test(u)) unit = 'Unit-2';
      }

      const tallyQty = outwardCol !== -1 ? cleanNumber(row[outwardCol]) : 0;
      const appQty = appCol !== -1 ? cleanNumber(row[appCol]) : 0;
      const status = statusCol !== -1 ? (cleanString(row[statusCol]) as any) : undefined;

      items.push({
        id: `tally-rec-${unit}-${Date.now()}-${i}`,
        unit,
        particulars: matName,
        materialName: matName,
        quantityKg: tallyQty,
        appConsumedKg: appQty,
        date: dateStr,
        status,
      });
    }

    return items;
  }

  // Fallback: Standard Tally Godown Summary Outward Format
  let detectedUnit: 'Unit-1' | 'Unit-2' = 'Unit-1';
  let dateDetected = dateStr;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].join(' ');
    if (/Unit-2/i.test(rowStr) || /Unit 2/i.test(rowStr)) {
      detectedUnit = 'Unit-2';
    } else if (/Unit-1/i.test(rowStr) || /Unit 1/i.test(rowStr)) {
      detectedUnit = 'Unit-1';
    }
    const dateMatch = rowStr.match(/(\d{1,2}[-.\/][a-zA-Z0-9]{3,}[-.\/]\d{2,4})/);
    if (dateMatch) {
      dateDetected = dateMatch[1];
    }
  }

  let particularsCol = 0;
  let qtyCol = 1;
  let summaryHeaderIdx = 0;

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    for (let c = 0; c < row.length; c++) {
      const val = cleanString(row[c]).toLowerCase();
      if (val.includes('particulars')) {
        summaryHeaderIdx = i;
        particularsCol = c;
      }
      if (val.includes('quantity') || val.includes('outward') || val.includes('kg')) {
        qtyCol = c;
      }
    }
  }

  const items: TallyOutwardItem[] = [];

  for (let i = summaryHeaderIdx + 1; i < rows.length; i++) {
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
 * Parses SKU Wise Regrind Stock Report CSV
 */
export function parseRegrindBalanceCsv(csvText: string): RegrindBalanceItem[] {
  const results = Papa.parse<any[]>(csvText, {
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length < 2) return [];

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

  const skuCol = getCol(['sku name', 'sku', 'product', 'item name']);
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
