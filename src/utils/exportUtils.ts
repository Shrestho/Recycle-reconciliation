import Papa from 'papaparse';
import { ReconciliationRow, SkuRegrindVsRejectionItem } from '../types';

/**
 * Downloads a string content as a file with UTF-8 BOM
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports SKU Wise Regrind Produced vs Production Rejection to CSV
 */
export function exportSkuRegrindToCsv(items: SkuRegrindVsRejectionItem[], date: string = '2026-09-24') {
  const data = items.map(item => ({
    'SKU Name': item.skuName,
    'Color': item.color,
    'Recycle Source': item.recycleSource,
    'Regrind Produced (Kg)': item.regrindProducedKg.toFixed(2),
    'Production Rejection (Kg)': item.productionRejectionKg.toFixed(2),
    'Crushed Delta (Kg)': item.crushedDeltaKg.toFixed(2),
    'Recovery Rate %': item.recoveryRatePercent.toFixed(1) + '%',
    'Opening Balance (Kg)': item.openingBalanceKg.toFixed(2),
    'Period Consumed (Kg)': item.periodConsumedKg.toFixed(2),
    'Closing Balance (Kg)': item.closingBalanceKg.toFixed(2),
    'Balance Unit-1 (Kg)': item.balanceU1Kg.toFixed(2),
    'Balance Unit-2 (Kg)': item.balanceU2Kg.toFixed(2),
  }));

  const csv = Papa.unparse(data);
  downloadFile(csv, `SKU_Regrind_vs_Rejection_${date}.csv`);
}

/**
 * Exports Tally Reconciliation Report with Opening & Closing stock to CSV
 */
export function exportReconciliationToCsv(rows: ReconciliationRow[], date: string = '2026-09-24', unit: string = 'All') {
  const data = rows.map(r => ({
    'Unit': r.unit,
    'Material Category': r.category,
    'Material Name': r.materialName,
    'Opening Stock in Mixing (Kg)': r.openingStockKg.toFixed(2),
    'Tally Outward from Store (Kg)': r.tallyOutwardKg.toFixed(2),
    'Total Available (Kg)': r.totalAvailableKg.toFixed(2),
    'Apps Mixing Consumed (Kg)': r.appConsumedKg.toFixed(2),
    'Production RM Consumption (Kg)': r.productionRmConsumptionKg.toFixed(2),
    'Mixing Return to Store (Kg)': r.mixingReturnKg.toFixed(2),
    'Closing Stock in Mixing (Kg)': r.closingStockKg.toFixed(2),
    'Variance Discrepancy (Kg)': r.varianceKg.toFixed(2),
    'App vs Tally Diff (Kg)': r.differenceAppTallyKg.toFixed(2),
    'Reconciliation Status': r.status,
    'Supervisor Remarks': r.notes || '',
  }));

  const csv = Papa.unparse(data);
  downloadFile(csv, `Tally_Reconciliation_${unit}_${date}.csv`);
}

/**
 * Formats table as Tab-Separated Values (TSV) for direct 1-click clipboard paste into Google Sheets
 */
export async function copyTableToClipboardForGoogleSheets(headers: string[], rows: (string | number)[][]): Promise<boolean> {
  try {
    const tsvContent = [
      headers.join('\t'),
      ...rows.map(row => row.map(cell => String(cell).replace(/\t|\n/g, ' ')).join('\t')),
    ].join('\n');

    await navigator.clipboard.writeText(tsvContent);
    return true;
  } catch (e) {
    console.error('Clipboard copy failed:', e);
    return false;
  }
}
