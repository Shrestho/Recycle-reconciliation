import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Check,
  X,
  ExternalLink,
  CloudCheck,
  CloudOff,
  RefreshCw,
  HelpCircle,
  Download,
  AlertCircle,
} from 'lucide-react';
import { GoogleSheetConfig, DailyReportSnapshot } from '../types';
import { APPS_SCRIPT_TEMPLATE, syncReportToGoogleSheet } from '../utils/googleSheetsSync';
import { exportReconciliationToCsv } from '../utils/exportUtils';

interface GoogleSheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetConfig;
  onSaveConfig: (config: GoogleSheetConfig) => void;
  latestReport?: DailyReportSnapshot;
}

export const GoogleSheetSettingsModal: React.FC<GoogleSheetSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  latestReport,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');
  const [autoSync, setAutoSync] = useState(config.autoSync ?? true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = () => {
    onSaveConfig({
      ...config,
      webhookUrl: webhookUrl.trim(),
      autoSync,
    });
    onClose();
  };

  const handleTestAndSync = async () => {
    if (!webhookUrl.trim() || !webhookUrl.trim().startsWith('http')) {
      setTestResult({
        success: false,
        message: 'Please enter a valid Google Apps Script Web App URL starting with https://',
      });
      return;
    }

    if (!latestReport) {
      setTestResult({
        success: false,
        message: 'No current report data available to sync.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await syncReportToGoogleSheet(latestReport, {
      ...config,
      webhookUrl: webhookUrl.trim(),
    });

    setTesting(false);
    setTestResult(res);

    if (res.success) {
      onSaveConfig({
        ...config,
        webhookUrl: webhookUrl.trim(),
        autoSync,
        lastSyncedAt: new Date().toISOString(),
        status: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Sheet Storage (No Auth Required)</h3>
              <p className="text-xs text-slate-400">
                Directly store daily reconciliation and regrind data into your Google Sheet without login
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Instructions Box */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center text-[10px] border border-emerald-800">
                ✓
              </span>
              <span>How It Works Without Google Login:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Google Apps Script allows any Google Sheet to receive secure data via a custom Web App endpoint. 
              Once deployed, this app can write daily reports directly to your sheet automatically!
            </p>

            {/* 3 Step Setup */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-cyan-400 block mb-1">Step 1: Open Sheet</span>
                <span className="text-slate-400 text-[11px]">
                  In your Google Sheet, click <strong>Extensions</strong> → <strong>Apps Script</strong>.
                </span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-cyan-400 block mb-1">Step 2: Paste Script</span>
                <span className="text-slate-400 text-[11px]">
                  Copy the script below, replace code in the editor, and click Save.
                </span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-bold text-cyan-400 block mb-1">Step 3: Deploy Web App</span>
                <span className="text-slate-400 text-[11px]">
                  Click <strong>Deploy</strong> → <strong>New deployment</strong> → Select <strong>Web app</strong> (Who has access: <em>Anyone</em>), then paste URL below.
                </span>
              </div>
            </div>

            {/* Copy Script Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleCopyScript}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold border border-slate-700 transition"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Apps Script Copied to Clipboard!' : 'Copy Ready-to-Paste Google Apps Script'}</span>
              </button>
            </div>
          </div>

          {/* Webhook URL Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block">
              Google Apps Script Web App URL:
            </label>
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-500 text-xs"
            />
            <p className="text-[11px] text-slate-500">
              Must end with <code className="text-slate-400">/exec</code>.
            </p>
          </div>

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200">Auto-sync on Daily Save</div>
              <div className="text-[11px] text-slate-400">
                Automatically push report to your Google Sheet whenever "Save Daily" is clicked
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => setAutoSync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Test & Sync Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Sync Now / Test Connection Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestAndSync}
              disabled={testing || !webhookUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold shadow-md shadow-emerald-950/40 transition"
            >
              {testing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudCheck className="w-3.5 h-3.5" />
              )}
              <span>{testing ? 'Testing & Syncing...' : 'Sync Current Report to Google Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
