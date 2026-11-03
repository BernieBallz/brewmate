import React from 'react';

// 16x16 pixel-art pint: F foam, B beer, H highlight, D shade, o bubble, G glass base
const ROWS = [
  '...FF.FFFF.FF...',
  '..FFFFFFFFFFFF..',
  '..FFFFFFFFFFFF..',
  '..HFBBBFBBBBFD..',
  '..HBBBBBBoBBBD..',
  '..HBBoBBBBBBBD..',
  '..HBBBBBBBBoBD..',
  '..HBBBBoBBBBBD..',
  '...HBBBBBBBBD...',
  '...HBBoBBBBBD...',
  '...HBBBBBBoBD...',
  '...HBBBBBBBBD...',
  '...HBBBoBBBBD...',
  '...GGGGGGGGGG...',
  '...GGGGGGGGGG...',
  '................',
];

const COLORS: Record<string, string> = {
  F: '#fef3c7',
  B: '#f59e0b',
  H: '#fcd34d',
  D: '#b45309',
  o: '#fde68a',
  G: '#94a3b8',
};

// One rect per run of same-coloured pixels
const RUNS = ROWS.flatMap((row, y) => {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  for (let x = 0; x < row.length; ) {
    const ch = row[x];
    let end = x + 1;
    while (end < row.length && row[end] === ch) end++;
    if (COLORS[ch]) runs.push({ x, y, w: end - x, fill: COLORS[ch] });
    x = end;
  }
  return runs;
});

// Render at a multiple of 16px so every pixel stays square
export const PixelBeerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
    {RUNS.map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
  </svg>
);
