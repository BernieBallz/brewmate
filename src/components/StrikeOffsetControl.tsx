import React from 'react';
import { useBrewStore } from '../store/brewStore';
import { Thermometer } from 'lucide-react';

interface StrikeOffsetControlProps {
  // 'large' gives bigger digits and buttons for the full-screen By stage view
  size?: 'normal' | 'large';
}

// Strike temperature (mash temp + brewer's offset) with -/+ 0.5° offset buttons
export const StrikeOffsetControl: React.FC<StrikeOffsetControlProps> = ({ size = 'normal' }) => {
  const strikeOffset = useBrewStore(state => state.strikeOffset);
  const recipe = useBrewStore(state => state.recipe);
  const setStrikeOffset = useBrewStore(state => state.setStrikeOffset);

  const mashTemp = recipe?.mash?.steps?.[0]?.stepTemp || 65;
  const targetStrikeTemp = Number((mashTemp + strikeOffset).toFixed(1));

  const isLarge = size === 'large';
  const buttonClass = `${isLarge ? 'w-16 h-14 text-base' : 'w-14 h-10 sm:h-11 text-sm'} rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 font-black font-mono text-amber-400 touch-press shadow flex items-center justify-center`;

  return (
    <>
      <div className={`${isLarge ? 'text-xs' : 'text-[11px]'} font-mono text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center space-x-1`}>
        <Thermometer className="w-3.5 h-3.5 mr-1" />
        <span>Mash {mashTemp}°C + Offset {strikeOffset >= 0 ? `+${strikeOffset}` : strikeOffset}°C</span>
      </div>

      {/* Stepper buttons flanking the strike temperature with large touch targets */}
      <div className={`flex items-center justify-center ${isLarge ? 'space-x-3 my-1' : 'space-x-2.5 my-0.5'}`}>
        <button
          type="button"
          onClick={() => setStrikeOffset(strikeOffset - 0.5)}
          className={buttonClass}
          title="Decrease strike offset"
        >
          -0.5°
        </button>

        <div className={`font-mono font-black ${isLarge ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'} text-amber-300 hud-glow tracking-tight px-1 leading-none`}>
          {targetStrikeTemp.toFixed(1)}°C
        </div>

        <button
          type="button"
          onClick={() => setStrikeOffset(strikeOffset + 0.5)}
          className={buttonClass}
          title="Increase strike offset"
        >
          +0.5°
        </button>
      </div>
    </>
  );
};
