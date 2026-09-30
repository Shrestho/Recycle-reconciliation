import { DailyReportSnapshot, GoogleSheetConfig } from '../types';

export const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for Astech Reconcile & Recycle Pro
 * No Google Auth Login Required!
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Click Extensions > Apps Script
 * 3. Delete any code and paste this entire code
 * 4. Click Deploy > New deployment
 * 5. Click gear icon next to "Select type" > Select "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone"
 * 8. Click "Deploy", authorize permissions, and copy the "Web app URL"
 * 9. Paste the URL into Astech Reconcile & Recycle Pro Settings
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Daily Summary Sheet
    var summarySheet = ss.getSheetByName("Daily_Summary") || ss.insertSheet("Daily_Summary");
    if (summarySheet.getLastRow() === 0) {
      summarySheet.appendRow([
        "Date", "Unit", "Total Tally Outward (Kg)", "Total Apps Consumed (Kg)", 
        "Total Production RM (Kg)", "Net Discrepancy (Kg)", "Matched Items", "Mismatched Items",
        "Total Rejection (Kg)", "Total Regrind Produced (Kg)", "Recovery Rate %", "Timestamp"
      ]);
      summarySheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    }
    
    var kpis = payload.kpis || {};
    summarySheet.appendRow([
      payload.date,
      payload.unit,
      kpis.totalTallyOutwardKg || 0,
      kpis.totalAppConsumedKg || 0,
      kpis.totalProductionRmKg || 0,
      kpis.totalVarianceKg || 0,
      kpis.matchCount || 0,
      kpis.mismatchCount || 0,
      kpis.totalRejectionKg || 0,
      kpis.totalRegrindProducedKg || 0,
      (kpis.recoveryRatePercent || 0) + "%",
      new Date().toLocaleString()
    ]);

    // 2. Tally Reconciliation Sheet
    var recSheet = ss.getSheetByName("Tally_Reconciliation") || ss.insertSheet("Tally_Reconciliation");
    if (recSheet.getLastRow() === 0) {
      recSheet.appendRow([
        "Date", "Unit", "Material Category", "Material Name", "Opening Stock (Kg)", 
        "Tally Outward (Kg)", "Total Available (Kg)", "Apps Consumed (Kg)", "Mixing Return (Kg)",
        "Closing Stock (Kg)", "Variance (Kg)", "Status", "Notes"
      ]);
      recSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#1e293b").setFontColor("#38bdf8");
    }
    
    if (payload.reconciliationRows && payload.reconciliationRows.length > 0) {
      for (var i = 0; i < payload.reconciliationRows.length; i++) {
        var r = payload.reconciliationRows[i];
        recSheet.appendRow([
          payload.date,
          r.unit,
          r.category,
          r.materialName,
          r.openingStockKg,
          r.tallyOutwardKg,
          r.totalAvailableKg,
          r.appConsumedKg,
          r.mixingReturnKg,
          r.closingStockKg,
          r.varianceKg,
          r.status,
          r.notes || ""
        ]);
      }
    }

    // 3. Regrind vs Rejection Sheet
    var rgSheet = ss.getSheetByName("Regrind_vs_Rejection") || ss.insertSheet("Regrind_vs_Rejection");
    if (rgSheet.getLastRow() === 0) {
      rgSheet.appendRow([
        "Date", "SKU Name", "Color", "Source", "Regrind Produced (Kg)", 
        "Production Rejection (Kg)", "Net Difference (Kg)", "Recovery Rate %",
        "Opening Bal (Kg)", "Consumed in Mixing (Kg)", "Closing Bal (Kg)"
      ]);
      rgSheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#064e3b").setFontColor("#34d399");
    }

    if (payload.skuRegrindRows && payload.skuRegrindRows.length > 0) {
      for (var j = 0; j < payload.skuRegrindRows.length; j++) {
        var g = payload.skuRegrindRows[j];
        rgSheet.appendRow([
          payload.date,
          g.skuName,
          g.color,
          g.recycleSource,
          g.regrindProducedKg,
          g.productionRejectionKg,
          g.crushedDeltaKg,
          g.recoveryRatePercent + "%",
          g.openingBalanceKg,
          g.periodConsumedKg,
          g.closingBalanceKg
        ]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data successfully synced to Google Sheet tabs!",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Astech Reconcile & Recycle Pro Sync Webhook",
    message: "Endpoint is ready to receive POST reports."
  })).setMimeType(ContentService.MimeType.JSON);
}
`;

/**
 * Sends a daily report snapshot to the configured Google Apps Script Webhook URL
 */
export async function syncReportToGoogleSheet(
  report: DailyReportSnapshot,
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
    return {
      success: false,
      message: 'Please configure a valid Google Apps Script Web App URL in settings.',
    };
  }

  const payload = {
    id: report.id,
    date: report.date,
    unit: report.unit,
    title: report.title,
    savedAt: report.savedAt,
    kpis: report.kpis,
    reconciliationRows: report.reconciliationRows,
    skuRegrindRows: report.skuRegrindRows,
  };

  try {
    // We send payload as text/plain or json
    // Apps Script redirects 302, mode: 'no-cors' guarantees delivery without browser CORS blocking
    await fetch(config.webhookUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: 'Data successfully sent to your Google Sheet!',
    };
  } catch (err: any) {
    console.error('Failed to sync to Google Sheet:', err);
    return {
      success: false,
      message: err?.message || 'Network error while contacting Google Sheet Webhook.',
    };
  }
}
