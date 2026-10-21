import React, { useState } from 'react';
import { useBrewStore } from '../store/brewStore';
import { Upload, FileText, AlertCircle, X } from 'lucide-react';
import type { BrewfatherRecipe } from '../types/brewfather';

interface RecipeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecipeUploadModal: React.FC<RecipeUploadModalProps> = ({ isOpen, onClose }) => {
  const { loadRecipe } = useBrewStore();
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate that the file is strictly a .json file
    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMsg('Invalid file format: Please select a Brewfather .json recipe file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BrewfatherRecipe;
        if (!parsed.name && !parsed.type) {
          throw new Error('JSON missing valid Brewfather recipe keys (name, type, etc.)');
        }
        loadRecipe(parsed);
        setErrorMsg(null);
        onClose();
      } catch (err: any) {
        setErrorMsg(`Failed to parse recipe file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteSubmit = () => {
    try {
      if (!jsonInput.trim()) {
        setErrorMsg('Please paste JSON text first');
        return;
      }
      const parsed = JSON.parse(jsonInput) as BrewfatherRecipe;
      if (!parsed.name) {
        throw new Error('Recipe JSON must have a "name" property');
      }
      loadRecipe(parsed);
      setErrorMsg(null);
      setJsonInput('');
      onClose();
    } catch (err: any) {
      setErrorMsg(`JSON Parse Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-950/95 backdrop-blur-xl border border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.2)] rounded-2xl p-5 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-black text-white font-mono uppercase tracking-wider">Import Brewfather Recipe</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="my-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs font-mono text-rose-200 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-3 space-y-4">

          {/* File Upload Box */}
          <div>
            <label className="text-xs font-mono font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Select Brewfather JSON file (.json)
            </label>
            <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-slate-900/40 backdrop-blur-sm">
              <input
                type="file"
                accept=".json,application/json,text/json"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileText className="w-8 h-8 text-amber-400/80 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-300">
                Tap to browse or drop your exported recipe JSON here
              </p>
              <span className="text-[10px] text-gray-500 font-mono">Supports standard Brewfather JSON export</span>
            </div>
          </div>

          {/* Or Paste Raw JSON */}
          <div>
            <label className="text-xs font-mono font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Or Paste JSON string
            </label>
            <textarea
              rows={4}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste recipe JSON object here..."
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/60 resize-none"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!jsonInput.trim()}
              className="w-full mt-2 py-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 active:bg-amber-800/70 text-amber-300 hover:text-white border border-amber-500/50 font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] disabled:opacity-40 disabled:border-slate-800 disabled:text-gray-600 touch-press"
            >
              Parse & Ingest JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
