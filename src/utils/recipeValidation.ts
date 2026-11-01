// Strict shape check for imported Brewfather recipes. Malformed recipes are rejected rather than repaired:
// a value of the wrong type (e.g. an amount that is an object) would otherwise be saved and break the app.

export const MAX_RECIPE_BYTES = 2 * 1024 * 1024; // real Brewfather exports are a few KB
const MAX_REPORTED_PROBLEMS = 5;

// Generous limits: nothing real comes close, but a value like 1e308 would turn a timer into Infinity
const MAX_MINUTES = 100_000;
const MAX_QUANTITY = 1_000_000;
const MAX_NAME_LENGTH = 200;

// Uses whose "time" schedules a timed addition. Other uses (e.g. dry hops, in days) don't drive a timer here.
const SCHEDULED_USES = ['Boil', 'First Wort', 'Whirlpool', 'Hopstand', 'Aroma', 'Flameout'];

type Json = Record<string, unknown>;

// Water-adjustment fields the parser reads (volume plus the salts it lists as additions)
const WATER_NUMBER_KEYS = ['volume', 'calciumChloride', 'calciumSulfate', 'magnesiumSulfate', 'magnesiumChloride',
  'sodiumChloride', 'sodiumBicarbonate', 'calciumCarbonate', 'calciumHydroxide', 'sodiumMetabisulfite'];

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isAbsent = (v: unknown) => v === undefined || v === null;

class ProblemList {
  readonly items: string[] = [];
  add(message: string) {
    this.items.push(message);
  }
  optionalNumber(obj: Json, key: string, where: string) {
    if (!isAbsent(obj[key]) && !isFiniteNumber(obj[key])) this.add(`${where}: "${key}" must be a number`);
  }
  requiredNumber(obj: Json, key: string, where: string) {
    if (!isFiniteNumber(obj[key])) this.add(`${where}: "${key}" must be a number`);
  }
  optionalString(obj: Json, key: string, where: string) {
    if (!isAbsent(obj[key]) && typeof obj[key] !== 'string') this.add(`${where}: "${key}" must be text`);
  }
  requiredString(obj: Json, key: string, where: string) {
    const value = obj[key];
    if (typeof value !== 'string' || value.trim() === '') this.add(`${where}: "${key}" is missing`);
    else if (value.length > MAX_NAME_LENGTH) this.add(`${where}: "${key}" is too long`);
  }
  // Only reports numbers outside the range; whether the value is a number at all is checked separately
  inRange(obj: Json, key: string, where: string, min: number, max: number) {
    const value = obj[key];
    if (isFiniteNumber(value) && (value < min || value > max)) this.add(`${where}: "${key}" is out of range (${value})`);
  }
}

const itemLabel = (kind: string, idx: number, item: Json) =>
  `${kind} #${idx + 1}${typeof item.name === 'string' && item.name ? ` "${item.name}"` : ''}`;

function checkList(
  problems: ProblemList,
  recipe: Json,
  key: string,
  kind: string,
  check: (item: Json, where: string) => void
) {
  const list = recipe[key];
  if (isAbsent(list)) return;
  if (!Array.isArray(list)) {
    problems.add(`"${key}" must be a list`);
    return;
  }
  list.forEach((item, idx) => {
    if (!isObject(item)) {
      problems.add(`${kind} #${idx + 1} is not a valid entry`);
      return;
    }
    check(item, itemLabel(kind, idx, item));
  });
}

function checkNumberFields(problems: ProblemList, obj: unknown, keys: string[], where: string) {
  if (isAbsent(obj)) return;
  if (!isObject(obj)) {
    problems.add(`"${where}" must be an object`);
    return;
  }
  keys.forEach(k => problems.optionalNumber(obj, k, where));
}

function checkWaterAdjustments(problems: ProblemList, adj: unknown, where: string) {
  if (isAbsent(adj)) return;
  if (!isObject(adj)) {
    problems.add(`"${where}" must be an object`);
    return;
  }
  Object.entries(adj).forEach(([k, v]) => {
    if (k === 'acids') {
      if (isAbsent(v)) return;
      if (!Array.isArray(v)) {
        problems.add(`${where}: "acids" must be a list`);
        return;
      }
      v.forEach((acid, idx) => {
        const acidWhere = `${where} acid #${idx + 1}`;
        if (!isObject(acid)) {
          problems.add(`${acidWhere} is not a valid entry`);
          return;
        }
        problems.optionalNumber(acid, 'amount', acidWhere);
        problems.optionalNumber(acid, 'concentration', acidWhere);
        problems.optionalString(acid, 'type', acidWhere);
        problems.optionalString(acid, 'unit', acidWhere);
      });
    } else if (WATER_NUMBER_KEYS.includes(k) && !isAbsent(v) && !isFiniteNumber(v)) {
      // Other water-tool fields are ignored here; the parser only uses numeric salt amounts and volume
      problems.add(`${where}: "${k}" must be a number`);
    }
  });
}

// Returns the problems found; an empty list means the recipe is safe to load.
export function validateRecipe(raw: unknown): string[] {
  const problems = new ProblemList();
  if (!isObject(raw)) return ['The file is not a Brewfather recipe (expected a JSON object).'];

  problems.requiredString(raw, 'name', 'Recipe');
  ['author', 'type', 'notes'].forEach(k => problems.optionalString(raw, k, 'Recipe'));

  // The essentials a brew day can't be built without: any other JSON file with a "name" stops here
  problems.requiredNumber(raw, 'batchSize', 'Recipe');
  problems.requiredNumber(raw, 'boilTime', 'Recipe');
  problems.inRange(raw, 'batchSize', 'Recipe', Number.MIN_VALUE, MAX_QUANTITY);
  problems.inRange(raw, 'boilTime', 'Recipe', 1, MAX_MINUTES);
  problems.inRange(raw, 'boilSize', 'Recipe', 0, MAX_QUANTITY);
  problems.inRange(raw, 'hopStandMinutes', 'Recipe', 0, MAX_MINUTES);
  problems.inRange(raw, 'hopstandMinutes', 'Recipe', 0, MAX_MINUTES);
  if (!Array.isArray(raw.fermentables) || raw.fermentables.length === 0) problems.add('Recipe: has no fermentables');
  if (!isObject(raw.mash) || !Array.isArray(raw.mash.steps) || raw.mash.steps.length === 0) problems.add('Recipe: has no mash steps');

  ['boilSize', 'efficiency', 'mashEfficiency', 'og', 'fg', 'abv', 'ibu', 'color',
    'preBoilGravity', 'postBoilGravity', 'primaryTemp', 'hopStandMinutes', 'hopstandMinutes', 'avgWeightedHopstandTemp']
    .forEach(k => problems.optionalNumber(raw, k, 'Recipe'));

  const checkTiming = (item: Json, where: string) => {
    problems.optionalNumber(item, 'time', where);
    if (typeof item.use === 'string' && SCHEDULED_USES.includes(item.use)) problems.inRange(item, 'time', where, 0, MAX_MINUTES);
  };

  checkList(problems, raw, 'fermentables', 'Fermentable', (f, where) => {
    problems.requiredString(f, 'name', where);
    problems.requiredNumber(f, 'amount', where);
    problems.inRange(f, 'amount', where, 0, MAX_QUANTITY);
    problems.optionalString(f, 'use', where);
    problems.optionalString(f, 'type', where);
    checkTiming(f, where);
  });
  checkList(problems, raw, 'hops', 'Hop', (h, where) => {
    problems.requiredString(h, 'name', where);
    problems.requiredNumber(h, 'amount', where);
    problems.inRange(h, 'amount', where, 0, MAX_QUANTITY);
    problems.optionalString(h, 'use', where);
    problems.optionalString(h, 'type', where);
    ['ibu', 'alpha', 'temp'].forEach(k => problems.optionalNumber(h, k, where));
    checkTiming(h, where);
  });
  checkList(problems, raw, 'miscs', 'Misc', (m, where) => {
    problems.requiredString(m, 'name', where);
    problems.requiredNumber(m, 'amount', where);
    problems.inRange(m, 'amount', where, 0, MAX_QUANTITY);
    ['use', 'unit', 'type', 'notes'].forEach(k => problems.optionalString(m, k, where));
    checkTiming(m, where);
  });
  checkList(problems, raw, 'yeasts', 'Yeast', (y, where) => {
    problems.requiredString(y, 'name', where);
    ['laboratory', 'unit', 'type', 'form'].forEach(k => problems.optionalString(y, k, where));
    ['amount', 'minTemp', 'maxTemp'].forEach(k => problems.optionalNumber(y, k, where));
  });

  if (!isAbsent(raw.mash)) {
    if (!isObject(raw.mash)) {
      problems.add('"mash" must be an object');
    } else {
      checkList(problems, raw.mash, 'steps', 'Mash step', (s, where) => {
        problems.optionalString(s, 'name', where);
        problems.requiredNumber(s, 'stepTemp', where);
        problems.requiredNumber(s, 'stepTime', where);
        problems.inRange(s, 'stepTemp', where, 0, 120);
        problems.inRange(s, 'stepTime', where, 0, MAX_MINUTES);
      });
      if (Array.isArray(raw.mash.steps) && raw.mash.steps.length > 0) {
        const totalMinutes = raw.mash.steps.reduce((sum: number, s) => sum + (isObject(s) && isFiniteNumber(s.stepTime) ? s.stepTime : 0), 0);
        if (totalMinutes <= 0) problems.add('Mash steps: the total mash time must be more than 0');
      }
    }
  }

  checkNumberFields(problems, raw.data, ['strikeWaterAmount', 'spargeWaterAmount', 'totalWaterAmount', 'mashVolume', 'strikeTemp'], 'data');
  checkNumberFields(problems, raw.equipment, ['batchSize', 'boilSize', 'boilTime', 'whirlpoolTime', 'hopstandMinutes', 'hopstandTemperature', 'spargeTemperature'], 'equipment');
  if (isObject(raw.equipment)) {
    problems.inRange(raw.equipment, 'whirlpoolTime', 'equipment', 0, MAX_MINUTES);
    problems.inRange(raw.equipment, 'hopstandMinutes', 'equipment', 0, MAX_MINUTES);
  }

  if (!isAbsent(raw.water)) {
    if (!isObject(raw.water)) {
      problems.add('"water" must be an object');
    } else {
      checkWaterAdjustments(problems, raw.water.mashAdjustments, 'Mash water');
      checkWaterAdjustments(problems, raw.water.spargeAdjustments, 'Sparge water');
    }
  }

  const found = problems.items;
  if (found.length <= MAX_REPORTED_PROBLEMS) return found;
  return [...found.slice(0, MAX_REPORTED_PROBLEMS), `…and ${found.length - MAX_REPORTED_PROBLEMS} more problem(s)`];
}
