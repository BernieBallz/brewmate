import { Leaf, FlaskConical, Pill, Sparkles } from 'lucide-react';
import type { StageAddition, StageId } from '../types/session';
import { isEnzymeAddition } from './brewfatherParser';

// Stage-aware addition badge label & styling
export const getAdditionBadge = (addition: StageAddition, stageId: StageId, boilTime: number) => {
  if (stageId === 'BOIL') {
    if (addition.triggerTimeMin >= boilTime) {
      return { label: `START`, bg: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
    }
    if (addition.triggerTimeMin === 0) {
      return { label: 'FLAMEOUT', bg: 'bg-red-950 text-red-300 border-red-800' };
    }
    return { label: `T-${addition.triggerTimeMin}m`, bg: 'bg-slate-800 text-amber-400 border-slate-700' };
  }
  if (stageId === 'WATER_PREP') {
    return { label: 'TO LIQUOR', bg: 'bg-sky-950 text-sky-300 border-sky-800' };
  }
  if (stageId === 'LAUTER_SPARGE') {
    return { label: 'TO SPARGE', bg: 'bg-sky-950 text-sky-300 border-sky-800' };
  }
  if (stageId === 'MASH_IN' || stageId === 'MASH_SCHEDULE') {
    return { label: 'DOUGH-IN', bg: 'bg-amber-950 text-amber-300 border-amber-800' };
  }
  if (stageId === 'HOPSTAND_WHIRLPOOL') {
    return { label: 'WHIRLPOOL', bg: 'bg-cyan-950 text-cyan-300 border-cyan-800' };
  }
  if (stageId === 'YEAST_PITCH') {
    return { label: 'AT PITCH', bg: 'bg-purple-950 text-purple-300 border-purple-800' };
  }
  return {
    label: addition.triggerTimeMin > 0 ? `T-${addition.triggerTimeMin}m` : 'ADDITION',
    bg: 'bg-slate-800 text-amber-400 border-slate-700'
  };
};

// Addition categorization helper for distinct visual scanning (Hops vs Finings vs Nutrients vs Sugars)
export const getAdditionTypeInfo = (addition: StageAddition) => {
  const isHop = addition.type === 'hop' || addition.name.toLowerCase().includes('hop');
  if (isHop) {
    return {
      isHop: true,
      tag: 'HOP',
      icon: Leaf,
      tagColor: 'bg-emerald-950 text-emerald-300 border-emerald-700/80',
      amountColor: 'text-emerald-400',
      borderAccent: 'border-l-4 border-l-emerald-400'
    };
  }
  const nameLower = addition.name.toLowerCase();
  if (nameLower.includes('protafloc') || nameLower.includes('whirlfloc') || nameLower.includes('finings')) {
    return {
      isHop: false,
      tag: 'FINING',
      icon: FlaskConical,
      tagColor: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
      amountColor: 'text-blue-300',
      borderAccent: 'border-l-4 border-l-blue-400'
    };
  }
  if (nameLower.includes('nutrient') || nameLower.includes('yeastlife') || nameLower.includes('zinc')) {
    return {
      isHop: false,
      tag: 'NUTRIENT',
      icon: Pill,
      tagColor: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
      amountColor: 'text-purple-300',
      borderAccent: 'border-l-4 border-l-purple-400'
    };
  }
  if (addition.type === 'sugar' || nameLower.includes('sugar') || nameLower.includes('dextrose')) {
    return {
      isHop: false,
      tag: 'SUGAR',
      icon: Sparkles,
      tagColor: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
      amountColor: 'text-amber-300',
      borderAccent: 'border-l-4 border-l-amber-400'
    };
  }
  if (addition.type === 'enzyme' || isEnzymeAddition(addition.name)) {
    return {
      isHop: false,
      tag: 'ENZYME',
      icon: FlaskConical,
      tagColor: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
      amountColor: 'text-rose-300',
      borderAccent: 'border-l-4 border-l-rose-400'
    };
  }
  return {
    isHop: false,
    tag: 'MISC',
    icon: FlaskConical,
    tagColor: 'bg-slate-800 text-gray-300 border-slate-700',
    amountColor: 'text-amber-400',
    borderAccent: 'border-l-4 border-l-slate-600'
  };
};
