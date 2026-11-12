import { describe, expect, it } from 'vitest';
import { type DecoEnv, planDive, type PlanInput, SUBSURFACE_ENV } from '../src';
import fixtures from './fixtures/reference-profiles.json';

interface Fixture {
  name: string;
  source: string;
  input: Omit<PlanInput, 'env'>;
  /** Konstanty prostředí referenční implementace; bez nich platí konstanty Subsurface. */
  env?: DecoEnv;
  /**
   * runtimeToleranceMin: výslovná tolerance celkového času. Používá se u reference, která drží na každé zastávce
   * nejméně minutu, kdežto náš plánovač zastávkou s už splněným stropem jen proplave; rozdíly po zastávkách se sčítají.
   */
  expected: { runtimeMin: number; runtimeToleranceMin?: number; stops?: { depthM: number; minutes: number }[] };
}

describe('referenční profily (viz deco/test/fixtures/README.md)', () => {
  for (const fixture of fixtures as Fixture[]) {
    it(fixture.name, () => {
      const plan = planDive({ ...fixture.input, env: fixture.env ?? SUBSURFACE_ENV });
      const runtimeTolerance = fixture.expected.runtimeToleranceMin ?? Math.ceil(fixture.expected.runtimeMin / 60);
      expect(Math.abs(plan.runtimeMin - fixture.expected.runtimeMin), `celkový čas ${plan.runtimeMin.toFixed(1)} min`).toBeLessThanOrEqual(runtimeTolerance);
      for (const expected of fixture.expected.stops ?? []) {
        const actual = plan.stops.find((stop) => stop.depthM === expected.depthM)?.minutes ?? 0;
        expect(Math.abs(actual - expected.minutes), `zastávka ${expected.depthM} m: ${actual} min`).toBeLessThanOrEqual(1);
      }
    });
  }
  it('sada obsahuje aspoň deset profilů', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });
});
