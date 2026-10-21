import fs from 'fs';

const rows = [
  ['1', 'Strike Water', 'STRIKE', 'strike-sparge-vol', 'Liquor [X]L / [Y]L', 'Stage start', 'Keep', '', ''],
  ['1', 'Strike Water', 'STRIKE', 'water-treat', 'Treat water', 'Stage start', 'Keep', '', ''],
  ['1', 'Strike Water', 'STRIKE', 'fv-cooler-on', 'FV cooling on', 'Stage start', 'Keep', '', ''],
  ['2', 'Mash In', 'MASH-IN', 'dough-in-flow', 'Grain in', 'Stage start', 'Keep', '', ''],
  ['2', 'Mash In', 'MASH-IN', 'mash-temp-init', 'Check mash temp [X]°C', 'Stage start', 'Keep', '', ''],
  ['2', 'Mash In', 'MASH-IN', 'mash-additions-check', 'Mash additions', 'Stage start', 'Keep', '', ''],
  ['2', 'Mash In', 'MASH-IN', 'dough-ball-check', 'No dough balls', 'Stage start', 'Keep', '', ''],
  ['3', 'Mash Rest', 'MASH', 'mash-temp-stable', 'Hold mash temp', 'Stage start', 'Keep', '', ''],
  ['3', 'Mash Rest', 'MASH', 'ph-sample', 'pH check (~5.2)', '15m into mash', 'Keep', '', ''],
  ['3', 'Mash Rest', 'MASH', 'iodine-test', 'Iodine test', '45m into mash', 'Keep', '', ''],
  ['3', 'Mash Rest', 'MASH', 'vorlauf-check', 'Vorlauf', 'Timed alert (~60m into mash)', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'sparge-prep', 'Sparge [X]°C', 'Stage start', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'equal-flow', 'Even flow', 'Continuous', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'kettle-early-heat', 'Kettle heat on', 'Once elements covered', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'runoff-gravity-cutoff', 'Stop before 1.010', 'Runoff tail', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'preboil-vol', 'Pre-boil volume [X]L', 'End of sparge', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'preboil-sg', 'Pre-boil SG [X]', 'End of sparge', 'Keep', '', ''],
  ['4', 'Lauter & Sparge', 'LAUTER', 'hot-break-ramp', 'Ramp to boil', 'Pre-boil ramp', 'Keep', '', ''],
  ['5', 'Boil', 'BOIL', 'rolling-boil', 'Rolling boil', 'Stage start', 'Keep', '', ''],
  ['5', 'Boil', 'BOIL', 'boil-additions-monitor', 'Additions', 'Throughout boil', 'Keep', '', ''],
  ['5', 'Boil', 'BOIL', 'whirlpool-prep', 'Sanitise whirlpool loop', 'T-15m to flameout', 'Keep', '', ''],
  ['5', 'Boil', 'BOIL', 'steam-heat-off', 'Heat off at flameout', 'At 00:00', 'Keep', '', ''],
  ['6', 'Whirlpool', 'WHIRLPOOL', 'cut-heat', 'Heat off', 'Stage start', 'Keep', '', ''],
  ['6', 'Whirlpool', 'WHIRLPOOL', 'whirlpool-additions', 'Whirlpool additions', 'Stage start', 'Keep', '', ''],
  ['6', 'Whirlpool', 'WHIRLPOOL', 'vortex-spin', 'Spin', 'First 5-10m', 'Keep', '', ''],
  ['6', 'Whirlpool', 'WHIRLPOOL', 'settle-cone', 'Settle cone', 'Last 10-15m', 'Keep', '', ''],
  ['7', 'Cooling Recirc', 'CHILL', 'hx-hot-sanitize', 'Sanitise loop', 'Stage start', 'Keep', '', ''],
  ['7', 'Cooling Recirc', 'CHILL', 'cooling-medium-on', 'Cooling on', 'Stage start', 'Keep', '', ''],
  ['7', 'Cooling Recirc', 'CHILL', 'temp-goal-60', 'Chill to 60°C', 'Continuous', 'Keep', '', ''],
  ['7', 'Cooling Recirc', 'CHILL', 'transfer-line-prep', 'Align valves', 'At 60°C', 'Keep', '', ''],
  ['8', 'Knockout', 'KNOCKOUT', 'start-aeration', 'Aeration on', 'Transfer start', 'Keep', '', ''],
  ['8', 'Knockout', 'KNOCKOUT', 'chiller-exit-temp', 'Exit temp [X]°C', 'Continuous', 'Keep', '', ''],
  ['8', 'Knockout', 'KNOCKOUT', 'postboil-sg', 'Record OG', 'Mid-transfer', 'Keep', '', ''],
  ['8', 'Knockout', 'KNOCKOUT', 'trub-cutoff', 'Stop at trub', 'Transfer end', 'Keep', '', ''],
  ['8', 'Knockout', 'KNOCKOUT', 'fv-volume-check', 'FV volume [X]L', 'Transfer end', 'Keep', '', ''],
  ['9', 'Yeast Pitch', 'PITCH', 'temp-confirm', 'Pitch temp [X]°C', 'Stage start', 'Keep', '', ''],
  ['9', 'Yeast Pitch', 'PITCH', 'pitch-additions', 'Yeast + aids', 'Stage start', 'Keep', '', ''],
  ['9', 'Yeast Pitch', 'PITCH', 'seal-fv', 'Seal FV', 'Stage start', 'Keep', '', ''],
  ['9', 'Yeast Pitch', 'PITCH', 'temp-controller-set', 'Set controller [X]°C', 'Stage start', 'Keep', '', ''],
  ['10', 'Clean Up', 'CLEANUP', 'spent-grain-dump', 'Spent grain out', 'Post-brew', 'Keep', '', ''],
  ['10', 'Clean Up', 'CLEANUP', 'chiller-backflush', 'Backflush chiller', 'Post-brew', 'Keep', '', ''],
  ['10', 'Clean Up', 'CLEANUP', 'brewhouse-cip', 'CIP', 'Post-brew', 'Keep', '', ''],
  ['10', 'Clean Up', 'CLEANUP', 'sanitizer-flush', 'Sanitiser flush', 'Post-brew', 'Keep', '', ''],
  ['10', 'Clean Up', 'CLEANUP', 'session-audit', 'Review log', 'Post-brew', 'Keep', '', '']
];

const headers = [
  'Stage Number',
  'Stage Name',
  'Stage Code',
  'Task ID',
  'Current Label',
  'Timing / Trigger',
  'Action (Keep / Rename / Remove)',
  'Proposed New Label',
  'Proposed Pop-up Explanation'
];

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const csvLines = [
  headers.map(escapeCsvCell).join(','),
  ...rows.map(r => r.map(escapeCsvCell).join(','))
];

// UTF-8 BOM so Excel opens it with perfect encoding
const csvContent = '\uFEFF' + csvLines.join('\r\n');

// 1. Write to Project Root
fs.writeFileSync('stage_reminders_template.csv', csvContent, 'utf8');
console.log('Saved to: stage_reminders_template.csv');

// 2. Write to Google Drive
try {
  fs.writeFileSync('F:/My Drive/stage_reminders_template.csv', csvContent, 'utf8');
  console.log('Saved to: F:/My Drive/stage_reminders_template.csv');
} catch (e) {
  console.log('Could not write to Google Drive:', e.message);
}

// 3. Write Markdown version to Project Root
const mdHeaders = '| ' + headers.join(' | ') + ' |';
const mdDivider = '| ' + headers.map(() => ':---').join(' | ') + ' |';
const mdRows = rows.map(r => '| ' + r.map(c => c || ' ').join(' | ') + ' |').join('\n');
const mdContent = `# BrewMate: Stage Reminders Template\n\n${mdHeaders}\n${mdDivider}\n${mdRows}\n`;

fs.writeFileSync('stage_reminders_template.md', mdContent, 'utf8');
console.log('Saved to: stage_reminders_template.md');
