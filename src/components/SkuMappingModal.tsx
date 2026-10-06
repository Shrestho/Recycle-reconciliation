import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { SkuNameMapping } from '../types';
import { parseSkuMappingCsv } from '../utils/csvParser';
import { downloadFile } from '../utils/exportUtils';
import Papa from 'papaparse';

interface SkuMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappings: SkuNameMapping[];
  onSaveMappings: (mappings: SkuNameMapping[]) => void;
  onResetDefault: () => void;
}

export const SkuMappingModal: React.FC<SkuMappingModalProps> = ({
  isOpen,
  onClose,
  mappings,
  onSaveMappings,
  onResetDefault,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for add / edit
  const [formRegrind, setFormRegrind] = useState('');
  const [formProd, setFormProd] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // File import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter mappings
  const filteredMappings = mappings.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.regrindSkuName.toLowerCase().includes(q) ||
      m.productionSkuName.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q)) ||
      (m.color && m.color.toLowerCase().includes(q))
    );
  });

  const handleStartAdd = () => {
    setEditingId(null);
    setFormRegrind('');
    setFormProd('');
    setFormColor('');
    setFormNotes('');
    setIsAdding(true);
  };

  const handleStartEdit = (m: SkuNameMapping) => {
    setIsAdding(false);
    setEditingId(m.id);
    setFormRegrind(m.regrindSkuName);
    setFormProd(m.productionSkuName);
    setFormColor(m.color || '');
    setFormNotes(m.notes || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRegrind.trim() || !formProd.trim()) return;

    if (editingId) {
      const updated = mappings.map(m =>
        m.id === editingId
          ? {
              ...m,
              regrindSkuName: formRegrind.trim(),
              productionSkuName: formProd.trim(),
              color: formColor.trim() || undefined,
              notes: formNotes.trim() || undefined,
            }
          : m
      );
      onSaveMappings(updated);
      setEditingId(null);
    } else {
      const newMap: SkuNameMapping = {
        id: `map-user-${Date.now()}`,
        regrindSkuName: formRegrind.trim(),
        productionSkuName: formProd.trim(),
        color: formColor.trim() || undefined,
        notes: formNotes.trim() || undefined,
      };
      onSaveMappings([newMap, ...mappings]);
      setIsAdding(false);
    }

    setFormRegrind('');
    setFormProd('');
    setFormColor('');
    setFormNotes('');
  };

  const handleDelete = (id: string) => {
    const updated = mappings.filter(m => m.id !== id);
    onSaveMappings(updated);
  };

  // Import mapping file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      if (!content) return;

      const parsed = parseSkuMappingCsv(content);
      if (parsed.length === 0) {
        setImportStatus('No valid mapping rows detected in uploaded file.');
        return;
      }

      // Merge with existing mappings (by unique regrind + prod key)
      const existingKeySet = new Set(
        mappings.map(m => `${m.regrindSkuName.toLowerCase()}__${m.productionSkuName.toLowerCase()}`)
      );
      const newItems = parsed.filter(
        p => !existingKeySet.has(`${p.regrindSkuName.toLowerCase()}__${p.productionSkuName.toLowerCase()}`)
      );

      const combined = [...newItems, ...mappings];
      onSaveMappings(combined);
      setImportStatus(`Successfully imported ${newItems.length} new SKU name mappings!`);
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export mappings to CSV
  const handleExportCsv = () => {
    const csvData = mappings.map(m => ({
      'Regrind SKU Name': m.regrindSkuName,
      'Production SKU Name': m.productionSkuName,
      Color: m.color || '',
      Notes: m.notes || '',
    }));
    const csvStr = Papa.unparse(csvData);
    downloadFile(csvStr, 'SKU_Similar_Name_Mappings.csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60 shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  SKU Similar Name Mapping Dictionary
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  {mappings.length} Mappings Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Maps "Regrind SKU Name" to similar/alias "Production SKU / Item Name" for accurate Rejection vs Regrind comparison
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Regrind SKU or Production Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-xs"
              title="Add a new similar name pair"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Similar Name</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Import similar name mapping CSV/Excel file"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={handleExportCsv}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Download Mappings CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              onClick={() => {
                if (confirm('Reset mappings to default ASTECH factory dictionary?')) {
                  onResetDefault();
                }
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Reset to Factory Defaults"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Status Alert if import triggered */}
        {importStatus && (
          <div className="px-6 py-2 bg-emerald-950/70 border-b border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* Add / Edit Form */}
        {(isAdding || editingId) && (
          <form
            onSubmit={handleSaveForm}
            className="p-4 bg-slate-950/80 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end text-xs"
          >
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                Regrind SKU Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Btl Pdnt 50g"
                value={formRegrind}
                onChange={e => setFormRegrind(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                Production SKU / Item Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PDNT Body 50 g"
                value={formProd}
                onChange={e => setFormProd(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                Color (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. White"
                value={formColor}
                onChange={e => setFormColor(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition"
              >
                {editingId ? 'Update Mapping' : 'Save Mapping'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Table of Mappings */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Regrind Stock SKU Name</th>
                  <th className="py-2.5 px-3 text-center w-10">&harr;</th>
                  <th className="py-2.5 px-3">Production Report Item Name</th>
                  <th className="py-2.5 px-3">Color</th>
                  <th className="py-2.5 px-3">Notes / Reason</th>
                  <th className="py-2.5 px-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No SKU mappings found matching "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map(m => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-emerald-300 font-mono text-[11px]">
                        {m.regrindSkuName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">&harr;</td>
                      <td className="py-2.5 px-3 font-semibold text-cyan-300 font-mono text-[11px]">
                        {m.productionSkuName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {m.color ? (
                          <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-[10px] text-slate-300">
                            {m.color}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Any Color</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-xs" title={m.notes}>
                        {m.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(m)}
                            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
                            title="Edit this mapping"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1 rounded-md bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                            title="Delete this mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/70 text-xs text-slate-400">
          <span>
            {filteredMappings.length} of {mappings.length} mappings displayed. All comparisons update automatically.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
