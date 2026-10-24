import { describe, it, expect } from 'vitest';
import testRecipe from '../fixtures/testRecipe.json';
import { validateRecipe } from '../../utils/recipeValidation';
import { neutraliseCsvFormula } from '../../utils/telemetryExport';

const clone = () => JSON.parse(JSON.stringify(testRecipe));

describe('Security regression tests', () => {
  describe('recipe validation (malformed recipes are rejected, not repaired)', () => {
    it('accepts a well-formed Brewfather recipe, including null optional values', () => {
      expect(validateRecipe(testRecipe)).toEqual([]);

      const withNulls = clone();
      withNulls.hops[0].time = null;
      withNulls.equipment.whirlpoolTime = null;
      withNulls.data.strikeTemp = null;
      withNulls.miscs[0].notes = null;
      expect(validateRecipe(withNulls)).toEqual([]);
    });

    it('rejects the malformed value that previously blanked the app', () => {
      const bad = clone();
      bad.miscs[4].amount = { not: 'a number' };
      const problems = validateRecipe(bad);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/Misc #5 .*"amount" must be a number/);
    });

    it('rejects non-objects, missing names, wrong list types and bad nested values', () => {
      expect(validateRecipe(null)[0]).toMatch(/not a Brewfather recipe/);
      expect(validateRecipe([1, 2])[0]).toMatch(/not a Brewfather recipe/);

      const noName = clone();
      delete noName.name;
      expect(validateRecipe(noName)).toContain('Recipe: "name" is missing');

      const hopsNotList = clone();
      hopsNotList.hops = { name: 'x' };
      expect(validateRecipe(hopsNotList)).toContain('"hops" must be a list');

      const badStep = clone();
      badStep.mash.steps[0].stepTime = '90 minutes';
      expect(validateRecipe(badStep).some(p => /Mash step #1.*"stepTime"/.test(p))).toBe(true);

      const badAcid = clone();
      badAcid.water.spargeAdjustments.acids[0].amount = 'lots';
      expect(validateRecipe(badAcid).some(p => /Sparge water acid #1.*"amount"/.test(p))).toBe(true);
    });

    it('ignores unknown water-tool fields but checks the salts it uses', () => {
      const extra = clone();
      extra.water.spargeAdjustments.someNewBrewfatherField = { nested: true };
      expect(validateRecipe(extra)).toEqual([]);

      extra.water.spargeAdjustments.calciumChloride = 'five';
      expect(validateRecipe(extra).some(p => /Sparge water.*"calciumChloride"/.test(p))).toBe(true);
    });

    it('caps the number of reported problems', () => {
      const many = clone();
      many.miscs.forEach((m: { amount: unknown }) => { m.amount = 'x'; });
      const problems = validateRecipe(many);
      expect(problems).toHaveLength(6);
      expect(problems[5]).toMatch(/more problem/);
    });
  });

  describe('CSV formula neutralisation', () => {
    it('prefixes text that a spreadsheet would run as a formula', () => {
      expect(neutraliseCsvFormula('=HYPERLINK("http://evil.example","Click")')).toBe('\'=HYPERLINK("http://evil.example","Click")');
      expect(neutraliseCsvFormula('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
      expect(neutraliseCsvFormula('@cmd')).toBe("'@cmd");
      expect(neutraliseCsvFormula('-2+3')).toBe("'-2+3");
      expect(neutraliseCsvFormula('\t=1')).toBe("'\t=1");
    });

    it('leaves numbers and ordinary text alone', () => {
      expect(neutraliseCsvFormula(-120)).toBe('-120');
      expect(neutraliseCsvFormula('-120')).toBe('-120');
      expect(neutraliseCsvFormula('+5.5')).toBe('+5.5');
      expect(neutraliseCsvFormula('Calcium Chloride (CaCl2)')).toBe('Calcium Chloride (CaCl2)');
      expect(neutraliseCsvFormula(null)).toBe('');
    });
  });
});
