import React, { useState } from 'react';
import { useBrewStore } from '../store/brewStore';
import { PixelBeerIcon } from './PixelBeerIcon';

// Pixel sparks thrown out from the pint: offset in px and colour
const SPARKS = [
  { dx: 0, dy: -56, color: 'bg-amber-300' },
  { dx: 44, dy: -44, color: 'bg-emerald-400' },
  { dx: 64, dy: 0, color: 'bg-amber-100' },
  { dx: 44, dy: 44, color: 'bg-amber-400' },
  { dx: 0, dy: 56, color: 'bg-emerald-300' },
  { dx: -44, dy: 44, color: 'bg-amber-300' },
  { dx: -64, dy: 0, color: 'bg-amber-100' },
  { dx: -44, dy: -44, color: 'bg-emerald-400' },
];

// Only a finish this recent gets the animation, so reopening a finished session shows it still
const CELEBRATE_WINDOW_MS = 10_000;

interface BrewCompleteCelebrationProps {
  subtitle: string;
  compact?: boolean;
}

// The finished screen in both flows: the pint spins in like a retro sprite alongside the completion chime
export const BrewCompleteCelebration: React.FC<BrewCompleteCelebrationProps> = ({ subtitle, compact = false }) => {
  const finishedAt = useBrewStore(state => state.finishedAt);
  const [celebrate] = useState(() => finishedAt !== null && Date.now() - finishedAt < CELEBRATE_WINDOW_MS);

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${compact ? 'mb-1.5' : 'mb-2'}`}>
        <div
          className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-2xl bg-emerald-950/90 border-2 border-emerald-500/80 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.4)] ${
            celebrate ? 'motion-safe:animate-pixel-spin' : ''
          }`}
        >
          <PixelBeerIcon className="w-8 h-8" />
        </div>
        {/* After the badge so the sparks fly over it */}
        {celebrate && SPARKS.map(s => (
          <span
            key={`${s.dx},${s.dy}`}
            className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 w-2 h-2 opacity-0 pointer-events-none motion-safe:animate-pixel-burst motion-reduce:hidden ${s.color}`}
            style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as React.CSSProperties}
          />
        ))}
      </div>
      <h2
        className={`${compact ? 'text-base sm:text-lg' : 'text-xl'} font-black text-white font-mono tracking-wider uppercase ${
          celebrate ? 'motion-safe:animate-pixel-blink' : ''
        }`}
      >
        Brew Session Complete!
      </h2>
      <p className={`${compact ? 'text-[11px] mt-0.5' : 'text-xs mt-1'} text-emerald-400 font-mono`}>{subtitle}</p>
    </div>
  );
};
