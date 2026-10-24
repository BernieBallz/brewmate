import React, { useState } from 'react';
import { useBrewStore } from '../store/brewStore';
import { Upload, FileText, AlertCircle, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { BrewfatherRecipe } from '../types/brewfather';
import { validateRecipe, MAX_RECIPE_BYTES } from '../utils/recipeValidation';

interface RecipeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Parsing is near-instant, so hold the spinner briefly to make it readable, then confirm before closing
const MIN_LOADING_MS = 600;
const SUCCESS_HOLD_MS = 1100;

type LoadPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; name: string; stageCount: number };

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const RecipeUploadModal: React.FC<RecipeUploadModalProps> = ({ isOpen, onClose }) => {
  const { loadRecipe } = useBrewStore();
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoadPhase>({ kind: 'idle' });

  if (!isOpen) return null;

  const reject = (message: string) => {
    setPhase({ kind: 'idle' });
    setErrorMsg(message);
  };

  // Shared by file upload and paste: parse, validate (malformed recipes are rejected, never repaired),
  // show progress, load, confirm, close
  const ingestRecipe = async (readText: () => Promise<string>) => {
    setErrorMsg(null);
    setPhase({ kind: 'loading' });
    const startedAt = Date.now();

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readText());
    } catch {
      reject('This isn’t valid JSON. Export the recipe from Brewfather as a JSON file and try again.');
      return;
    }

    const problems = validateRecipe(parsed);
    if (problems.length > 0) {
      reject(`This recipe can’t be loaded:\n• ${problems.join('\n• ')}`);
      return;
    }

    try {
      const recipe = parsed as BrewfatherRecipe;
      await wait(Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt)));
      loadRecipe(recipe);
      setPhase({ kind: 'done', name: recipe.name, stageCount: useBrewStore.getState().stages.length });
      setJsonInput('');
      await wait(SUCCESS_HOLD_MS);
      setPhase({ kind: 'idle' });
      onClose();
    } catch (err: any) {
      reject(`This recipe couldn’t be turned into brew stages: ${err?.message || String(err)}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Validate that the file is strictly a .json file
    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMsg('Invalid file format: Please select a Brewfather .json recipe file.');
      return;
    }
    if (file.size > MAX_RECIPE_BYTES) {
      setErrorMsg('This file is too large to be a Brewfather recipe (limit 2 MB).');
      return;
    }

    void ingestRecipe(() => file.text());
  };

  const handlePasteSubmit = () => {
    if (!jsonInput.trim()) {
      setErrorMsg('Please paste JSON text first');
      return;
    }
    if (jsonInput.length > MAX_RECIPE_BYTES) {
      setErrorMsg('This is too large to be a Brewfather recipe (limit 2 MB).');
      return;
    }
    void ingestRecipe(async () => jsonInput);
  };

  const isBusy = phase.kind !== 'idle';

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
            disabled={isBusy}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase.kind === 'loading' ? (
          /* Loading: brief spinner while the recipe is read and turned into brew stages */
          <div className="py-10 flex flex-col items-center justify-center text-center" role="status" aria-live="polite">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            <p className="mt-3 text-sm font-mono font-bold text-amber-200 uppercase tracking-wider">Loading recipe…</p>
            <p className="mt-1 text-xs text-gray-400">Building your brew day stages</p>
          </div>
        ) : phase.kind === 'done' ? (
          /* Success: confirm what was loaded, then the modal closes itself */
          <div className="py-10 flex flex-col items-center justify-center text-center" role="status" aria-live="polite">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="mt-3 text-base font-bold text-white break-words max-w-full">{phase.name} loaded</p>
            <p className="mt-1 text-xs font-mono text-emerald-300">{phase.stageCount} stages ready</p>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="my-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs font-mono text-rose-200 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="whitespace-pre-line break-words">{errorMsg}</span>
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
          </>
        )}
      </div>
    </div>
  );
};
