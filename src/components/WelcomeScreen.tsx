import React from 'react';
import { Flame, FolderOpen } from 'lucide-react';

interface WelcomeScreenProps {
  onLoadRecipe: () => void;
}

// Shown until a recipe is loaded: BrewMate ships with no built-in recipe
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLoadRecipe }) => (
  <div className="flex-1 min-h-0 flex items-center justify-center p-6 select-none">
    <div className="w-full max-w-sm text-center flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-brew-amber flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
        <Flame className="w-7 h-7" />
      </div>

      <h1 className="font-mono font-black text-xl tracking-widest text-white uppercase">BrewMate</h1>
      <p className="text-sm text-gray-300 mt-2">Load a Brewfather recipe to start your brew day.</p>
      <p className="text-xs text-gray-500 mt-1">Export the recipe from Brewfather as a JSON file, then load it here.</p>

      <button
        onClick={onLoadRecipe}
        className="mt-6 w-full min-h-[50px] py-2.5 rounded-xl font-mono font-black text-sm tracking-widest uppercase flex items-center justify-center space-x-2 border bg-amber-950/60 hover:bg-amber-900/70 active:bg-amber-800/80 text-amber-200 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all touch-press"
      >
        <FolderOpen className="w-5 h-5" />
        <span>Load Recipe</span>
      </button>
    </div>
  </div>
);
