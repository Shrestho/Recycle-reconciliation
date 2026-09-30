import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  FileText,
} from 'lucide-react';
import {
  parseProductionCsv,
  parseTallyOutwardsCsv,
  parseRegrindBalanceCsv,
} from '../utils/csvParser';
import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  UnitType,
} from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProduction: (items: ProductionItem[]) => void;
  onImportTally: (items: TallyOutwardItem[]) => void;
  onImportRegrind: (items: RegrindBalanceItem[]) => void;
  onLoadSampleData: () => void;
  selectedUnit: UnitType;
  selectedDate: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportProduction,
  onImportTally,
  onImportRegrind,
  onLoadSampleData,
  selectedUnit,
  selectedDate,
}) => {
  const [importType, setImportType] = useState<'production' | 'tally' | 'regrind'>('production');
  const [pastedText, setPastedText] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setFileInfo({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        setPastedText(text);
        tryParse(text, importType);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file. Please ensure it is a valid CSV or text file.');
    };
    reader.readAsText(file);
  };

  const tryParse = (text: string, type: typeof importType) => {
    try {
      if (type === 'production') {
        const parsed = parseProductionCsv(text, selectedUnit === 'All' ? 'Unit-1' : selectedUnit);
        setPreviewCount(parsed.length);
        if (parsed.length === 0) {
          setErrorMsg('No production rows detected. Please check CSV header columns.');
        }
      } else if (type === 'tally') {
        const parsed = parseTallyOutwardsCsv(text, selectedDate);
        setPreviewCount(parsed.length);
        if (parsed.length === 0) {
          setErrorMsg('No Tally outwards rows detected.');
        }
      } else if (type === 'regrind') {
        const parsed = parseRegrindBalanceCsv(text);
        setPreviewCount(parsed.length);
        if (parsed.length === 0) {
          setErrorMsg('No SKU regrind rows detected.');
        }
      }
    } catch (e: any) {
      setErrorMsg(`Parsing error: ${e.message}`);
    }
  };

  const handleApplyImport = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Please upload a file or paste CSV content first.');
      return;
    }

    try {
      if (importType === 'production') {
        const parsed = parseProductionCsv(pastedText, selectedUnit === 'All' ? 'Unit-1' : selectedUnit);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any production rows.');
          return;
        }
        onImportProduction(parsed);
        setSuccessMsg(`Successfully imported ${parsed.length} production & consumption records!`);
      } else if (importType === 'tally') {
        const parsed = parseTallyOutwardsCsv(pastedText, selectedDate);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any Tally outward rows.');
          return;
        }
        onImportTally(parsed);
        setSuccessMsg(`Successfully imported ${parsed.length} Tally outward godown records!`);
      } else if (importType === 'regrind') {
        const parsed = parseRegrindBalanceCsv(pastedText);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any Regrind balance rows.');
          return;
        }
        onImportRegrind(parsed);
        setSuccessMsg(`Successfully imported ${parsed.length} SKU regrind balance records!`);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setErrorMsg(`Import failed: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Operational Data</h3>
              <p className="text-xs text-slate-400">
                Import CSV files with tolerance for extra columns or formatting quirks
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Quick Demo Loader */}
          <div className="bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border border-cyan-800/60 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-white">Load Official 24-Sep-2026 Shift Data</span>
                <p className="text-slate-400 text-[11px]">
                  Instantly populates Unit-1 & Unit-2 Tally outwards, mixing, and SKU regrind balance.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onLoadSampleData();
                setSuccessMsg('24-Sep-2026 datasets loaded successfully!');
                setTimeout(onClose, 900);
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold whitespace-nowrap transition"
            >
              Load Shift Data
            </button>
          </div>

          {/* Import Type Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Select Data File Category:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportType('production');
                  setPastedText('');
                  setPreviewCount(null);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  importType === 'production'
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">1. Production & RM Consumption</div>
                <div className="text-[10px] mt-0.5 text-slate-400">
                  Excel / Apps file (RM, MB %, Total Consumption, Rejection)
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportType('tally');
                  setPastedText('');
                  setPreviewCount(null);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  importType === 'tally'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">2. Tally ERP Godown Outwards</div>
                <div className="text-[10px] mt-0.5 text-slate-400">
                  Godown summary from Tally Prime (Unit-1 or Unit-2)
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportType('regrind');
                  setPastedText('');
                  setPreviewCount(null);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  importType === 'regrind'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">3. Regrind SKU Balance</div>
                <div className="text-[10px] mt-0.5 text-slate-400">
                  Crushing section produced vs consumed & warehouse balance
                </div>
              </button>
            </div>
          </div>

          {/* File Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/50 p-6 rounded-2xl text-center cursor-pointer transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileSpreadsheet className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 mx-auto mb-2 transition" />
            <div className="text-xs font-semibold text-slate-200">
              Click to browse or drop CSV / TXT file here
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Supports CSV, TSV, or exported text files with extra columns
            </div>
            {fileInfo && (
              <div className="mt-2 text-xs font-mono text-cyan-400">
                Loaded: {fileInfo.name} ({fileInfo.size})
              </div>
            )}
          </div>

          {/* Or Paste Raw Text */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Or paste raw CSV / table text:</span>
              {previewCount !== null && (
                <span className="text-emerald-400 font-semibold">
                  {previewCount} valid rows detected
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={pastedText}
              placeholder="Product Name,Colour,MB Grade,RM,Filler MB %,MB %,Total RM Consumption (kg),Mixing Return(kg),Total Rejection (kg)..."
              onChange={e => {
                setPastedText(e.target.value);
                tryParse(e.target.value, importType);
              }}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Status Feedback */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            onClick={handleApplyImport}
            disabled={!pastedText.trim()}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Apply & Recalculate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
