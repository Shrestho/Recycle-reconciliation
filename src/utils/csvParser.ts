import Papa from 'papaparse';
import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  MaterialCategory,
  SkuNameMapping,
} from '../types';

/**
 * Normalizes text for matching and cleaning
 */
export function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces/BOM
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // normalize all unicode spaces
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' '); // collapse duplicate spaces
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

  // Find primary header row (looks for "Item Name" or "Product Name" or "RM Grade" or "Rejection" or "M/C")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowStr = rows[i].map(c => cleanString(c).toLowerCase()).join(' ');
    if (
      (rowStr.includes('item name') || rowStr.includes('product name') || rowStr.includes('item')) &&
      (rowStr.includes('rm') || rowStr.includes('grade') || rowStr.includes('rejection') || rowStr.includes('reject') || rowStr.includes('m/c'))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 0;

  // Check if headerIndex + 1 is a sub-header row (e.g., specifying units like "(Pcs)", "(kg)", "kg", "pcs", "%", "gm")
  let dataStartIndex = headerIndex + 1;
  let isSubHeaderRow = false;
  if (headerIndex + 1 < rows.length) {
    const nextRowStr = rows[headerIndex + 1].map(c => cleanString(c).toLowerCase()).join(' ');
    // If it contains unit indicators and does NOT look like data (no BM-, no IBM-, no product name like 'bottle', 'cap')
    if (
      (nextRowStr.includes('pcs') || nextRowStr.includes('(pcs)') || nextRowStr.includes('kg') || nextRowStr.includes('(kg)') || nextRowStr.includes('nos')) &&
      !nextRowStr.includes('bm-') &&
      !nextRowStr.includes('ibm-') &&
      !nextRowStr.includes('bottle') &&
      !nextRowStr.includes('cap')
    ) {
      isSubHeaderRow = true;
      dataStartIndex = headerIndex + 2;
    }
  }

  // Construct composite header that merges parent header and sub-header if present
  // Also handles Excel merged cells where parent cell was merged over 2 columns
  const primaryHeader = rows[headerIndex].map(c => cleanString(c).toLowerCase());
  const subHeader = isSubHeaderRow ? rows[headerIndex + 1].map(c => cleanString(c).toLowerCase()) : [];

  const maxCols = Math.max(primaryHeader.length, subHeader.length);
  const header: string[] = [];

  let lastNonEmptyParent = '';
  for (let c = 0; c < maxCols; c++) {
    let parent = primaryHeader[c] || '';
    if (parent) {
      lastNonEmptyParent = parent;
    } else if (isSubHeaderRow && (subHeader[c]?.includes('kg') || subHeader[c]?.includes('pcs')) && lastNonEmptyParent) {
      // Propagate merged parent header from previous column (e.g. Total Rejection merged across Pcs and Kg)
      parent = lastNonEmptyParent;
    }

    const sub = subHeader[c] || '';
    const combined = cleanString(`${parent} ${sub}`).toLowerCase();
    header.push(combined);
  }

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
  
  // Helper to test if a column is piece counts / numbers instead of weight in kg
  const isPcsHeader = (h: string): boolean => {
    const s = h.toLowerCase().trim();
    // Never mark as PCS if it explicitly mentions kg/weight
    if (s.includes('kg') || s.includes('k.g') || s.includes('kgs') || s.includes('weight') || s.includes('wt')) {
      return false;
    }
    return (
      s.includes('pcs') ||
      s.includes('(pcs)') ||
      s.includes('[pcs]') ||
      s.includes(' pc') ||
      s.includes('(pc)') ||
      s.includes('[pc]') ||
      s.includes('piece') ||
      s.includes('pieces') ||
      s.includes('nos') ||
      s.includes('(nos)') ||
      s.includes('[nos]') ||
      s.includes('count') ||
      s.includes('qty') ||
      s.includes('quantity') ||
      /\b(pcs|pc|nos|no|qty|count|piece|pieces)\b/i.test(s) ||
      /\((pcs|pc|nos|no|qty|count)\)/i.test(s)
    );
  };

  // -------------------------------------------------------------
  // REJECTION COLUMN RESOLUTION:
  // Must take value strictly from "Total Rejection (kg)" and NEVER from "Total Reject (Pcs)"!
  // -------------------------------------------------------------
  let rejKgCol = -1;
  let rejPcsCol = -1;

  // 1. Locate piece count column first to safely isolate and exclude it from weight
  rejPcsCol = header.findIndex(
    h =>
      (h.includes('rejection') || h.includes('reject') || h.includes('rej')) &&
      isPcsHeader(h)
  );

  // 2. Highest priority for Kg: Look for explicit Total Rejection in Kg
  const totalRejKgNames = [
    'total rejection (kg)',
    'total rejection(kg)',
    'total rejection [kg]',
    'total rejection in kg',
    'total rejection kg',
    'total rejection kgs',
    'total rejection (kgs)',
    'total rejection (kg.)',
    'total rejection (k.g)',
    'total reject (kg)',
    'total reject(kg)',
    'total reject [kg]',
    'total reject in kg',
    'total reject kg',
    'total rej (kg)',
    'total rej(kg)',
    'total rej. (kg)',
    'rejection (kg)',
    'rejection(kg)',
    'rejection [kg]',
    'rejection in kg',
    'rejection kg',
    'rejection kgs',
    'rejection (kgs)',
    'rejection (kg.)',
    'rejection (k.g)',
    'reject (kg)',
    'reject(kg)',
    'reject [kg]',
    'reject in kg',
    'reject kg',
    'rej (kg)',
    'rej(kg)',
  ];

  for (const name of totalRejKgNames) {
    const idx = header.findIndex(
      (h, i) => i !== rejPcsCol && h.includes(name) && !isPcsHeader(h)
    );
    if (idx !== -1) {
      rejKgCol = idx;
      break;
    }
  }

  // 3. Second priority: Any column containing rejection/reject/rej AND kg/weight, but NOT pcs
  if (rejKgCol === -1) {
    rejKgCol = header.findIndex(
      (h, i) =>
        i !== rejPcsCol &&
        (h.includes('rejection') || h.includes('reject') || h.includes('rej')) &&
        (h.includes('kg') || h.includes('k.g') || h.includes('kgs') || h.includes('weight') || h.includes('wt')) &&
        !isPcsHeader(h)
    );
  }

  // 4. Third priority: Look for 'total rejection' or 'rejection' strictly excluding any piece column
  if (rejKgCol === -1) {
    rejKgCol = header.findIndex(
      (h, i) =>
        i !== rejPcsCol &&
        (h.includes('total rejection') || h.includes('rejection')) &&
        !isPcsHeader(h)
    );
  }

  // 5. Fallback for rejPcsCol if not found earlier: Look for 'total reject' column if rejKgCol is different
  if (rejPcsCol === -1) {
    rejPcsCol = header.findIndex(
      (h, i) =>
        i !== rejKgCol &&
        (h.includes('total reject') || h.includes('reject')) &&
        (isPcsHeader(h) || !h.includes('kg'))
    );
  }

  // 6. Strict sanity verification: rejKgCol and rejPcsCol MUST NEVER be the same column
  if (rejKgCol !== -1 && rejPcsCol !== -1 && rejKgCol === rejPcsCol) {
    rejPcsCol = -1;
  }

  // 7. Data-level sanity check:
  // Sample 3-5 data rows. If rejKgCol was somehow matched to piece counts (e.g. huge integers > 100 with no decimals)
  // while rejPcsCol has small decimal weights (e.g. 15.4, 33.99 kg), auto-correct and swap them!
  if (rejKgCol !== -1 && rejPcsCol !== -1) {
    let kgColIsLikelyPcs = 0;
    let pcsColIsLikelyKg = 0;
    const sampleLimit = Math.min(rows.length, dataStartIndex + 8);
    for (let r = dataStartIndex; r < sampleLimit; r++) {
      const vKg = cleanNumber(rows[r]?.[rejKgCol]);
      const vPcs = cleanNumber(rows[r]?.[rejPcsCol]);
      // If vKg is a large integer (> 100) and vPcs is smaller with decimals, or vKg > 10 * vPcs
      if (vKg > 50 && Number.isInteger(vKg) && vPcs > 0 && vPcs < vKg) {
        kgColIsLikelyPcs++;
      }
      if (vPcs > 0 && !Number.isInteger(vPcs) && vKg > vPcs) {
        pcsColIsLikelyKg++;
      }
    }
    if (kgColIsLikelyPcs >= 2 || (kgColIsLikelyPcs >= 1 && pcsColIsLikelyKg >= 1)) {
      // Swap columns so that rejKgCol strictly holds the Kg weight!
      const temp = rejKgCol;
      rejKgCol = rejPcsCol;
      rejPcsCol = temp;
    }
  }

  const matConsCol = getCol(['material consumption (kg)', 'total rm consumption', 'consumption (kg)', 'consumption']);
  const mixRetCol = getCol(['mixing return (kg)', 'mixing return', 'return']);
  const unitCol = getCol(['unit']);

  const parsedItems: ProductionItem[] = [];

  for (let i = dataStartIndex; i < rows.length; i++) {
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
    const totalRejection = rejKgCol !== -1 ? cleanNumber(row[rejKgCol]) : 0;
    const totalRejectionPcs = rejPcsCol !== -1 ? cleanNumber(row[rejPcsCol]) : undefined;
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
      totalRejection, // Strictly from "Total Rejection (kg)"
      totalRejectionPcs, // Total Reject (Pcs)
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

/**
 * Parses SKU Similar Name Mapping CSV/Text
 * Expected columns:
 * - Regrind SKU Name (or SKU Name, Regrind Name, Similar Regrind Name)
 * - Production SKU Name (or Production Item Name, Item Name, Product Name, Similar Production Name)
 * - Optional: Color, Notes
 */
export function parseSkuMappingCsv(csvContent: string): SkuNameMapping[] {
  if (!csvContent || typeof csvContent !== 'string') return [];

  const results = Papa.parse<string[]>(csvContent.trim(), {
    header: false,
    skipEmptyLines: 'greedy',
  });

  const rows = results.data;
  if (!rows || rows.length < 2) return [];

  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map(c => cleanString(c).toLowerCase()).join(' ');
    if (
      (rowStr.includes('regrind') && rowStr.includes('production')) ||
      (rowStr.includes('sku') && rowStr.includes('item')) ||
      rowStr.includes('similar') ||
      rowStr.includes('mapping')
    ) {
      headerIndex = i;
      break;
    }
  }

  const header = rows[headerIndex].map(c => cleanString(c).toLowerCase());
  const getCol = (names: string[]): number =>
    header.findIndex(h => names.some(n => h.includes(n.toLowerCase())));

  let regrindCol = getCol([
    'regrind sku name',
    'regrind sku',
    'regrind name',
    'regrind',
    'sku name',
    'sku',
  ]);
  let prodCol = getCol([
    'production sku name',
    'production sku',
    'production item name',
    'production name',
    'production',
    'item name',
    'product name',
    'similar name',
  ]);
  const colorCol = getCol(['color', 'colour']);
  const notesCol = getCol(['notes', 'remark', 'remarks', 'reason', 'alias']);

  // If header detection fails to distinguish, assume column 0 is Regrind and column 1 is Production
  if (regrindCol === -1 && rows[headerIndex].length >= 2) regrindCol = 0;
  if (prodCol === -1 && rows[headerIndex].length >= 2) prodCol = regrindCol === 0 ? 1 : 0;

  const mappings: SkuNameMapping[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const regrindSkuName = regrindCol !== -1 && row[regrindCol] ? cleanString(row[regrindCol]) : '';
    const productionSkuName = prodCol !== -1 && row[prodCol] ? cleanString(row[prodCol]) : '';

    if (!regrindSkuName || !productionSkuName) continue;

    mappings.push({
      id: `map-import-${Date.now()}-${i}`,
      regrindSkuName,
      productionSkuName,
      color: colorCol !== -1 && row[colorCol] ? cleanString(row[colorCol]) : undefined,
      notes: notesCol !== -1 && row[notesCol] ? cleanString(row[notesCol]) : 'Imported mapping',
    });
  }

  return mappings;
}
