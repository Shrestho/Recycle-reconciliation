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
  Layers,
  Trash2,
  Plus,
  ArrowRight,
  Database,
  Factory,
  Recycle,
  ArrowRightLeft,
} from 'lucide-react';
import {
  parseProductionCsv,
  parseTallyOutwardsCsv,
  parseRegrindBalanceCsv,
  parseSkuMappingCsv,
  cleanString,
} from '../utils/csvParser';
import {
  ProductionItem,
  TallyOutwardItem,
  RegrindBalanceItem,
  UnitType,
  ProductionSection,
  SkuNameMapping,
} from '../types';

export interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: string;
  category: 'production' | 'tally' | 'regrind';
  section?: 'Blow' | 'Injection' | 'Other';
  unit?: 'Unit-1' | 'Unit-2' | 'All';
  parsedProduction?: ProductionItem[];
  parsedTally?: TallyOutwardItem[];
  parsedRegrind?: RegrindBalanceItem[];
  itemCount: number;
  status: 'valid' | 'warning' | 'error';
  errorDetails?: string;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProduction: (items: ProductionItem[], mode?: 'merge' | 'replace') => void;
  onImportTally: (items: TallyOutwardItem[], mode?: 'merge' | 'replace') => void;
  onImportRegrind: (items: RegrindBalanceItem[], mode?: 'merge' | 'replace') => void;
  onImportSkuMappings?: (mappings: SkuNameMapping[]) => void;
  onImportBatch: (batch: {
    productionItems: ProductionItem[];
    tallyItems: TallyOutwardItem[];
    regrindItems: RegrindBalanceItem[];
    mode: 'merge' | 'replace';
  }) => void;
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
  onImportSkuMappings,
  onImportBatch,
  onLoadSampleData,
  selectedUnit,
  selectedDate,
}) => {
  const [activeTab, setActiveTab] = useState<'multi' | 'single'>('multi');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Multi-file queue
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Single file / Paste state
  const [singleType, setSingleType] = useState<'production' | 'tally' | 'regrind' | 'mapping'>('production');
  const [pastedText, setPastedText] = useState('');
  const [singlePreviewCount, setSinglePreviewCount] = useState<number | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  // Feedback messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-detect file type, unit, and section based on filename and header lines
  const autoDetectFileInfo = (
    fileName: string,
    fileContent: string
  ): { category: 'production' | 'tally' | 'regrind'; section?: 'Blow' | 'Injection' | 'Other'; unit?: 'Unit-1' | 'Unit-2' | 'All' } => {
    const fn = fileName.toLowerCase();
    const snippet = fileContent.slice(0, 1500).toLowerCase();

    // 1. Tally Reconciliation / Outwards
    if (
      fn.includes('tally') ||
      fn.includes('reconciliation') ||
      (snippet.includes('material name') && snippet.includes('tally outward')) ||
      snippet.includes('godown summary') ||
      snippet.includes('outwards')
    ) {
      let unit: 'Unit-1' | 'Unit-2' | 'All' = 'Unit-1';
      if (fn.includes('unit-2') || fn.includes('unit 2') || fn.includes('u-2') || snippet.includes('unit-2') || snippet.includes('unit 2')) {
        unit = 'Unit-2';
      } else if (fn.includes('unit-1') || fn.includes('unit 1') || fn.includes('u-1') || snippet.includes('unit-1') || snippet.includes('unit 1')) {
        unit = 'Unit-1';
      }
      return { category: 'tally', unit };
    }

    // 2. Regrind Stock Report
    if (
      fn.includes('regrind') ||
      fn.includes('stock_report') ||
      snippet.includes('period produced') ||
      (snippet.includes('sku name') && snippet.includes('opening balance'))
    ) {
      return { category: 'regrind', unit: 'All' };
    }

    // 3. Daily Production Report (Blow / Injection)
    let section: 'Blow' | 'Injection' | 'Other' = 'Blow';
    if (fn.includes('injection') || fn.includes('ibm') || snippet.includes('injection') || snippet.includes('ibm-')) {
      section = 'Injection';
    } else if (fn.includes('blow') || snippet.includes('blow molding') || snippet.includes('bm-')) {
      section = 'Blow';
    }

    let unit: 'Unit-1' | 'Unit-2' | 'All' = 'All';
    if (fn.includes('unit-1') || fn.includes('u1')) unit = 'Unit-1';
    else if (fn.includes('unit-2') || fn.includes('u2')) unit = 'Unit-2';

    return { category: 'production', section, unit };
  };

  // Process uploaded files in multi-file mode
  const handleMultiFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const newQueuedFiles: QueuedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const detected = autoDetectFileInfo(file.name, text);

        let itemCount = 0;
        let parsedProduction: ProductionItem[] | undefined;
        let parsedTally: TallyOutwardItem[] | undefined;
        let parsedRegrind: RegrindBalanceItem[] | undefined;
        let status: 'valid' | 'warning' | 'error' = 'valid';
        let errorDetails: string | undefined;

        if (detected.category === 'production') {
          parsedProduction = parseProductionCsv(text, detected.unit === 'Unit-2' ? 'Unit-2' : 'Unit-1');
          itemCount = parsedProduction.length;
          if (itemCount === 0) {
            status = 'warning';
            errorDetails = 'No production items parsed. Check column names.';
          }
        } else if (detected.category === 'tally') {
          parsedTally = parseTallyOutwardsCsv(text, selectedDate);
          itemCount = parsedTally.length;
          if (itemCount === 0) {
            status = 'warning';
            errorDetails = 'No Tally outward items parsed.';
          }
        } else if (detected.category === 'regrind') {
          parsedRegrind = parseRegrindBalanceCsv(text);
          itemCount = parsedRegrind.length;
          if (itemCount === 0) {
            status = 'warning';
            errorDetails = 'No SKU regrind rows parsed.';
          }
        }

        newQueuedFiles.push({
          id: `queue-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          file,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          category: detected.category,
          section: detected.section,
          unit: detected.unit,
          parsedProduction,
          parsedTally,
          parsedRegrind,
          itemCount,
          status,
          errorDetails,
        });
      } catch (err: any) {
        console.error(err);
      }
    }

    setFileQueue(prev => [...prev, ...newQueuedFiles]);
  };

  const handleRemoveQueueItem = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateQueueCategory = (id: string, newCategory: 'production' | 'tally' | 'regrind') => {
    setFileQueue(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          category: newCategory,
        };
      })
    );
  };

  const handleUpdateQueueSection = (id: string, newSection: 'Blow' | 'Injection') => {
    setFileQueue(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        // Also update items section if production
        const updatedProd = item.parsedProduction?.map(p => ({ ...p, section: newSection }));
        return {
          ...item,
          section: newSection,
          parsedProduction: updatedProd,
        };
      })
    );
  };

  const handleUpdateQueueUnit = (id: string, newUnit: 'Unit-1' | 'Unit-2') => {
    setFileQueue(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updatedTally = item.parsedTally?.map(t => ({ ...t, unit: newUnit }));
        const updatedProd = item.parsedProduction?.map(p => ({ ...p, unit: newUnit }));
        return {
          ...item,
          unit: newUnit,
          parsedTally: updatedTally,
          parsedProduction: updatedProd,
        };
      })
    );
  };

  // Apply all queued multi-files
  const handleApplyMultiImport = () => {
    if (fileQueue.length === 0) {
      setErrorMsg('Please select at least one file to import.');
      return;
    }

    let allProduction: ProductionItem[] = [];
    let allTally: TallyOutwardItem[] = [];
    let allRegrind: RegrindBalanceItem[] = [];

    fileQueue.forEach(item => {
      if (item.category === 'production' && item.parsedProduction) {
        allProduction = [...allProduction, ...item.parsedProduction];
      } else if (item.category === 'tally' && item.parsedTally) {
        allTally = [...allTally, ...item.parsedTally];
      } else if (item.category === 'regrind' && item.parsedRegrind) {
        allRegrind = [...allRegrind, ...item.parsedRegrind];
      }
    });

    onImportBatch({
      productionItems: allProduction,
      tallyItems: allTally,
      regrindItems: allRegrind,
      mode: importMode,
    });

    setSuccessMsg(
      `Successfully processed ${fileQueue.length} files (${allProduction.length} Production items, ${allTally.length} Tally items, ${allRegrind.length} Regrind SKUs)!`
    );

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Single file paste/upload handler
  const handleApplySingleImport = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Please upload a file or paste CSV content first.');
      return;
    }

    try {
      if (singleType === 'production') {
        const parsed = parseProductionCsv(pastedText, selectedUnit === 'All' ? 'Unit-1' : selectedUnit);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any production rows.');
          return;
        }
        onImportProduction(parsed, importMode);
        setSuccessMsg(`Imported ${parsed.length} production items!`);
      } else if (singleType === 'tally') {
        const parsed = parseTallyOutwardsCsv(pastedText, selectedDate);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any Tally outward rows.');
          return;
        }
        onImportTally(parsed, importMode);
        setSuccessMsg(`Imported ${parsed.length} Tally outward records!`);
      } else if (singleType === 'regrind') {
        const parsed = parseRegrindBalanceCsv(pastedText);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any Regrind balance rows.');
          return;
        }
        onImportRegrind(parsed, importMode);
        setSuccessMsg(`Imported ${parsed.length} SKU regrind balance records!`);
      } else if (singleType === 'mapping') {
        const parsed = parseSkuMappingCsv(pastedText);
        if (parsed.length === 0) {
          setErrorMsg('Could not parse any SKU similar name mapping rows.');
          return;
        }
        if (onImportSkuMappings) {
          onImportSkuMappings(parsed);
        }
        setSuccessMsg(`Imported ${parsed.length} SKU similar name mappings!`);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setErrorMsg(`Import failed: ${e.message}`);
    }
  };

  // Aggregate stats of queued files
  const queuedProdCount = fileQueue
    .filter(f => f.category === 'production')
    .reduce((s, f) => s + f.itemCount, 0);

  const queuedTallyCount = fileQueue
    .filter(f => f.category === 'tally')
    .reduce((s, f) => s + f.itemCount, 0);

  const queuedRegrindCount = fileQueue
    .filter(f => f.category === 'regrind')
    .reduce((s, f) => s + f.itemCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/50">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Multiple Operational Reports</h3>
              <p className="text-xs text-slate-400">
                Batch import 1. Daily Production (Blow & Injection) and 2. Tally Reconciliation / Outwards (Unit-1 & Unit-2)
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

        {/* Mode Selector Tabs: Multi-File Batch vs Single/Paste */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950/40 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('multi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'multi'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Multi-File Batch Upload ({fileQueue.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'single'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Single File / Paste Text</span>
            </button>
          </div>

          {/* Merge vs Replace Mode */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Import Mode:</span>
            <div className="bg-slate-950 rounded-lg p-0.5 border border-slate-800 flex items-center">
              <button
                onClick={() => setImportMode('merge')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  importMode === 'merge' ? 'bg-cyan-900 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Combines multiple files with current operational data"
              >
                Merge / Combine
              </button>
              <button
                onClick={() => setImportMode('replace')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  importMode === 'replace' ? 'bg-rose-950 text-rose-200' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Clears current shift data and replaces with these files"
              >
                Replace All
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* 1-Click Official Dataset Loader Banner */}
          <div className="bg-gradient-to-r from-cyan-950/60 via-blue-950/60 to-slate-900 border border-cyan-800/70 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-white">Load Official 01-Oct-2026 Shift Package (All 4 Files)</span>
                <p className="text-slate-400 text-[11px]">
                  Loads Blow & Injection production + Unit-1 & Unit-2 Tally reconciliation + SKU regrind stock report.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onLoadSampleData();
                setSuccessMsg('01-Oct-2026 official datasets loaded successfully!');
                setTimeout(onClose, 900);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold whitespace-nowrap transition shadow-md shadow-cyan-950/40"
            >
              Load 01-Oct Package
            </button>
          </div>

          {activeTab === 'multi' ? (
            /* MULTI-FILE BATCH MODE */
            <div className="space-y-4">
              {/* Dropzone with multiple select */}
              <div
                onClick={() => multiFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/50 p-6 rounded-2xl text-center cursor-pointer transition group"
              >
                <input
                  ref={multiFileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.txt,.tsv"
                  onChange={handleMultiFilesSelected}
                  className="hidden"
                />
                <div className="flex justify-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 flex items-center justify-center">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-950/80 text-blue-400 border border-blue-800/60 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center justify-center">
                    <Recycle className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Click to select multiple files or drag & drop all files together
                </div>
                <div className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  Select your <strong>Daily Production (Blow & Injection)</strong>, <strong>Tally Outwards (Unit-1 & Unit-2)</strong>, and <strong>SKU Regrind</strong> files at once.
                </div>
              </div>

              {/* File Queue Section */}
              {fileQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                    <span>Selected Files ({fileQueue.length}):</span>
                    <button
                      onClick={() => setFileQueue([])}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Clear Queue
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {fileQueue.map(item => (
                      <div
                        key={item.id}
                        className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div
                            className={`p-2 rounded-lg ${
                              item.category === 'production'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60'
                                : item.category === 'tally'
                                ? 'bg-blue-950 text-blue-400 border border-blue-800/60'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 truncate max-w-xs" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>{item.size}</span>
                              <span>•</span>
                              <span className="text-emerald-400 font-medium">{item.itemCount} valid rows</span>
                            </div>
                          </div>
                        </div>

                        {/* Category & Section Configuration Controls */}
                        <div className="flex items-center gap-2">
                          {/* Category Selector */}
                          <select
                            value={item.category}
                            onChange={e => handleUpdateQueueCategory(item.id, e.target.value as any)}
                            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-hidden"
                          >
                            <option value="production">Daily Production</option>
                            <option value="tally">Tally Outward / Rec</option>
                            <option value="regrind">SKU Regrind Stock</option>
                          </select>

                          {/* Section Tag for Production (Blow vs Injection) */}
                          {item.category === 'production' && (
                            <select
                              value={item.section || 'Blow'}
                              onChange={e => handleUpdateQueueSection(item.id, e.target.value as any)}
                              className="bg-slate-900 border border-cyan-800 text-cyan-300 text-xs rounded-lg px-2 py-1 focus:outline-hidden font-semibold"
                            >
                              <option value="Blow">Blow Molding</option>
                              <option value="Injection">Injection / IBM</option>
                            </select>
                          )}

                          {/* Unit Tag for Tally (Unit-1 vs Unit-2) */}
                          {item.category === 'tally' && (
                            <select
                              value={item.unit || 'Unit-1'}
                              onChange={e => handleUpdateQueueUnit(item.id, e.target.value as any)}
                              className="bg-slate-900 border border-blue-800 text-blue-300 text-xs rounded-lg px-2 py-1 focus:outline-hidden font-semibold"
                            >
                              <option value="Unit-1">Unit-1</option>
                              <option value="Unit-2">Unit-2</option>
                            </select>
                          )}

                          {/* Remove item button */}
                          <button
                            onClick={() => handleRemoveQueueItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Batch Summary Bar */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="text-slate-400">
                      Total To Import:{' '}
                      <span className="text-cyan-300 font-semibold">{queuedProdCount} Production items</span>
                      {' '}&bull;{' '}
                      <span className="text-blue-300 font-semibold">{queuedTallyCount} Tally items</span>
                      {' '}&bull;{' '}
                      <span className="text-emerald-300 font-semibold">{queuedRegrindCount} Regrind SKUs</span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Mode: <strong className="text-white capitalize">{importMode}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SINGLE FILE / PASTE TEXT MODE */
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Single File Category:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSingleType('production')}
                    className={`p-3 rounded-xl border text-left transition ${
                      singleType === 'production'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">1. Daily Production Report</div>
                    <div className="text-[10px] mt-0.5 text-slate-400">
                      Blow & Injection (Item Name, RM Grade, Rejection)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSingleType('tally')}
                    className={`p-3 rounded-xl border text-left transition ${
                      singleType === 'tally'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">2. Tally Reconciliation / Outward</div>
                    <div className="text-[10px] mt-0.5 text-slate-400">
                      Unit-1 or Unit-2 (Material Name, Tally Outward)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSingleType('regrind')}
                    className={`p-3 rounded-xl border text-left transition ${
                      singleType === 'regrind'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">3. Regrind Stock Report</div>
                    <div className="text-[10px] mt-0.5 text-slate-400">
                      SKU Name, Period Produced, Balances
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSingleType('mapping')}
                    className={`p-3 rounded-xl border text-left transition ${
                      singleType === 'mapping'
                        ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">4. SKU Similar Names Mapping</div>
                    <div className="text-[10px] mt-0.5 text-slate-400">
                      Regrind SKU Name &harr; Production SKU Name
                    </div>
                  </button>
                </div>
              </div>

              {/* Paste Text Area */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Paste table text or CSV content:</span>
                  {singlePreviewCount !== null && (
                    <span className="text-emerald-400 font-semibold">
                      {singlePreviewCount} valid rows detected
                    </span>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={pastedText}
                  placeholder={
                    singleType === 'mapping'
                      ? 'Paste mapping CSV rows here (e.g. "Regrind SKU Name, Production SKU Name")...'
                      : 'Paste CSV rows here...'
                  }
                  onChange={e => {
                    setPastedText(e.target.value);
                    if (singleType === 'production') {
                      setSinglePreviewCount(parseProductionCsv(e.target.value, 'Unit-1').length);
                    } else if (singleType === 'tally') {
                      setSinglePreviewCount(parseTallyOutwardsCsv(e.target.value, selectedDate).length);
                    } else if (singleType === 'regrind') {
                      setSinglePreviewCount(parseRegrindBalanceCsv(e.target.value).length);
                    } else {
                      setSinglePreviewCount(parseSkuMappingCsv(e.target.value).length);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Feedback Banners */}
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
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Cancel
          </button>

          {activeTab === 'multi' ? (
            <button
              type="button"
              onClick={handleApplyMultiImport}
              disabled={fileQueue.length === 0}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import & Combine All Files ({fileQueue.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApplySingleImport}
              disabled={!pastedText.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Apply Single Import</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
