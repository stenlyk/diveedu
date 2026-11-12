import { AIR, EAN50, haldaneTissuePressure, OXYGEN, trimix } from '@diveedu/calc';
import { describe, expect, it } from 'vitest';
import {
  ambientBar,
  ceilingM,
  COMPARTMENTS,
  coefficients,
  gfNow,
  HE_A, HE_B, HE_HALF_TIMES,
  load,
  mValue,
  N2_A, N2_B, N2_HALF_TIMES,
  noDecoLimit,
  planDive,
  SUBSURFACE_ENV,
  surfaceTissues,
  surfacingGf,
  TEACHING_ENV,
  toleratedAmbient,
} from '../src';

const airDive = (depthM: number, bottomMinutes: number, gfLow = 100, gfHigh = 100) => planDive({ depthM, bottomMinutes, gases: [{ gas: AIR }], gfLow, gfHigh });

describe('tabulky ZHL-16C', () => {
  it('mají 16 kompartmentů a očekávaný průběh', () => {
    for (const table of [N2_HALF_TIMES, N2_A, N2_B, HE_HALF_TIMES, HE_A, HE_B]) expect(table).toHaveLength(COMPARTMENTS);
    for (let i = 1; i < COMPARTMENTS; i++) {
      expect(N2_HALF_TIMES[i]!).toBeGreaterThan(N2_HALF_TIMES[i - 1]!);
      expect(N2_A[i]!).toBeLessThan(N2_A[i - 1]!); // pomalé tkáně snesou menší přesycení
      expect(N2_B[i]!).toBeGreaterThan(N2_B[i - 1]!);
      expect(HE_HALF_TIMES[i]!).toBeLessThan(N2_HALF_TIMES[i]!); // helium je rychlejší
    }
  });
  it('poměr poločasů dusíku a helia je přibližně 2,65', () => {
    for (let i = 0; i < COMPARTMENTS; i++) expect(N2_HALF_TIMES[i]! / HE_HALF_TIMES[i]!).toBeCloseTo(2.65, 1);
  });
});

describe('sycení tkání', () => {
  it('na hladině jsou tkáně v rovnováze se vzduchem a nemění se', () => {
    const start = surfaceTissues();
    expect(start.n2[0]).toBeCloseTo((1 - 0.0627) * 0.79, 10);
    const later = load(start, AIR, 0, 0, 600);
    later.n2.forEach((p, i) => expect(p).toBeCloseTo(start.n2[i]!, 10));
  });
  it('ve stálé hloubce odpovídá Haldaneově rovnici z calc', () => {
    const start = surfaceTissues();
    const after = load(start, AIR, 30, 30, 20);
    const inspired = (4 - 0.0627) * 0.79;
    N2_HALF_TIMES.forEach((half, i) => expect(after.n2[i]).toBeCloseTo(haldaneTissuePressure(start.n2[i]!, inspired, half, 20), 10));
  });
  it('lineární sestup (Schreiner) odpovídá součtu mnoha krátkých kroků', () => {
    const exact = load(surfaceTissues(), AIR, 0, 40, 2);
    let stepped = surfaceTissues();
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const mid = (40 * (i + 0.5)) / n;
      stepped = load(stepped, AIR, mid, mid, 2 / n);
    }
    exact.n2.forEach((p, i) => expect(p).toBeCloseTo(stepped.n2[i]!, 5));
  });
  it('po velmi dlouhé době se tkáň vyrovná s vdechovaným tlakem', () => {
    const saturated = load(surfaceTissues(), trimix(18, 45), 60, 60, 100_000);
    expect(saturated.n2[15]).toBeCloseTo((7 - 0.0627) * 0.37, 6);
    expect(saturated.he[15]).toBeCloseTo((7 - 0.0627) * 0.45, 6);
  });
  it('helium se sytí rychleji než dusík', () => {
    const after = load(surfaceTissues(), trimix(20, 40), 50, 50, 10);
    const heShare = after.he[5]! / ((6 - 0.0627) * 0.4);
    const n2Share = (after.n2[5]! - surfaceTissues().n2[5]!) / ((6 - 0.0627) * 0.4 - surfaceTissues().n2[5]!);
    expect(heShare).toBeGreaterThan(n2Share * 2);
  });
  it('nulový čas nic nemění a neplatné vstupy vyhodí chybu', () => {
    const start = surfaceTissues();
    expect(load(start, AIR, 30, 30, 0)).toEqual(start);
    expect(() => load(start, AIR, 30, 30, -1)).toThrow();
    expect(() => load(start, AIR, -1, 30, 1)).toThrow();
  });
});

describe('M-hodnoty a gradient factors', () => {
  it('M-hodnota je a + P / b', () => {
    const tissues = surfaceTissues();
    expect(mValue(tissues, 0, 1)).toBeCloseTo(1.1696 + 1 / 0.5578, 10);
    expect(mValue(tissues, 15, 4)).toBeCloseTo(0.2327 + 4 / 0.9653, 10);
  });
  it('koeficienty se váží podle poměru dusíku a helia', () => {
    const mixed = { n2: Array<number>(16).fill(1), he: Array<number>(16).fill(1) };
    expect(coefficients(mixed, 0).a).toBeCloseTo((1.1696 + 1.6189) / 2, 10);
    expect(coefficients({ n2: Array<number>(16).fill(0), he: Array<number>(16).fill(0) }, 3)).toEqual({ a: N2_A[3], b: N2_B[3], inert: 0 });
  });
  it('při GF 100 je tolerovaný tlak právě ten, kde tkáň dosáhne M-hodnoty', () => {
    const tissues = load(surfaceTissues(), AIR, 40, 40, 30);
    for (let i = 0; i < COMPARTMENTS; i++) {
      const tolerated = toleratedAmbient(tissues, i, 1);
      expect(mValue(tissues, i, tolerated)).toBeCloseTo(coefficients(tissues, i).inert, 8);
    }
  });
  it('při GF 30 tkáň čerpá 30 % rozdílu mezi okolním tlakem a M-hodnotou', () => {
    const tissues = load(surfaceTissues(), AIR, 40, 40, 30);
    const tolerated = toleratedAmbient(tissues, 2, 0.3);
    const used = (coefficients(tissues, 2).inert - tolerated) / (mValue(tissues, 2, tolerated) - tolerated);
    expect(used).toBeCloseTo(0.3, 8);
  });
  it('nižší GF znamená hlubší strop', () => {
    const tissues = load(surfaceTissues(), AIR, 40, 40, 30);
    expect(ceilingM(tissues, 0.3)).toBeGreaterThan(ceilingM(tissues, 0.85));
    expect(ceilingM(tissues, 0.85)).toBeGreaterThan(ceilingM(tissues, 1));
    expect(ceilingM(surfaceTissues(), 1)).toBeLessThan(0);
  });
  it('GF99 je na dně záporný a po rychlém výstupu kladný', () => {
    const tissues = load(surfaceTissues(), AIR, 40, 40, 30);
    expect(gfNow(tissues, 40).percent).toBeLessThan(0);
    expect(surfacingGf(tissues).percent).toBeGreaterThan(100);
    expect(gfNow(tissues, ceilingM(tissues, 1)).percent).toBeCloseTo(100, 6);
  });
});

describe('dekompresní rozvrh', () => {
  it('krátký mělký ponor nemá zastávky', () => {
    const plan = airDive(18, 30);
    expect(plan.stops).toEqual([]);
    expect(plan.firstStopM).toBe(0);
    expect(plan.runtimeMin).toBeCloseTo(30 + 18 / 9, 6);
    expect(plan.educationalOnly).toBe(true);
  });
  it('bezdekompresní limit vzduchu při GF 100/100 leží v očekávaném pásmu', () => {
    // Orientační pásma podle publikovaných Bühlmannových tabulek (liší se konvencemi sestupu a výstupu).
    const ndl = (depth: number) => noDecoLimit({ depthM: depth, gases: [{ gas: AIR }], gfLow: 100, gfHigh: 100 });
    expect(ndl(18)).toBeGreaterThanOrEqual(45);
    expect(ndl(18)).toBeLessThanOrEqual(75);
    expect(ndl(30)).toBeGreaterThanOrEqual(14);
    expect(ndl(30)).toBeLessThanOrEqual(25);
    expect(ndl(40)).toBeGreaterThanOrEqual(7);
    expect(ndl(40)).toBeLessThanOrEqual(13);
    expect(ndl(30)).toBeLessThan(ndl(18));
    expect(ndl(3)).toBe(300);
    expect(noDecoLimit({ depthM: 60, gases: [{ gas: AIR }], gfLow: 20, gfHigh: 20 }, 60)).toBe(0);
    // Dlouhý čas s konzervativním GF je mimo rozsah modelu – limit se přesto najde.
    expect(noDecoLimit({ depthM: 30, gases: [{ gas: AIR }], gfLow: 70, gfHigh: 70 })).toBeGreaterThan(5);
    // Jiná chyba vstupu se nepolyká.
    expect(() => noDecoLimit({ depthM: 30, gases: [], gfLow: 70, gfHigh: 70 })).toThrow(/plyn/);
  });
  it('dlouhý hluboký ponor má zastávky po 3 m od nejhlubší k nejmělčí', () => {
    const plan = airDive(45, 30, 30, 85);
    expect(plan.stops.length).toBeGreaterThan(3);
    plan.stops.forEach((stop, i) => {
      expect(stop.depthM % 3).toBe(0);
      expect(stop.minutes).toBeGreaterThan(0);
      if (i > 0) expect(stop.depthM).toBeLessThan(plan.stops[i - 1]!.depthM);
    });
    expect(plan.firstStopM).toBe(plan.stops[0]!.depthM);
    expect(plan.stops[plan.stops.length - 1]!.depthM).toBe(3);
  });
  it('strop není v žádném okamžiku porušen', () => {
    for (const plan of [airDive(45, 30, 30, 85), airDive(40, 40, 100, 100), planDive({ depthM: 60, bottomMinutes: 25, gases: [{ gas: trimix(18, 45) }, { gas: EAN50, switchDepthM: 21 }, { gas: OXYGEN, switchDepthM: 6 }], gfLow: 40, gfHigh: 80 })]) {
      for (const sample of plan.samples) expect(sample.depthM).toBeGreaterThanOrEqual(sample.ceilingM - 1e-4);
    }
  });
  it('na hladinu se dorazí s GF nejvýš GF high', () => {
    for (const [low, high] of [[30, 70], [50, 85], [100, 100]] as const) {
      const plan = airDive(45, 30, low, high);
      expect(plan.surfacingGfPercent).toBeLessThanOrEqual(high + 0.01);
      expect(plan.surfacingGfPercent).toBeGreaterThan(high - 15);
    }
  });
  it('konzervativnější GF high prodlužuje dekompresi', () => {
    expect(airDive(45, 30, 30, 70).runtimeMin).toBeGreaterThan(airDive(45, 30, 30, 85).runtimeMin);
    expect(airDive(45, 30, 30, 85).runtimeMin).toBeGreaterThan(airDive(45, 30, 100, 100).runtimeMin);
  });
  it('nižší GF low posouvá první zastávku hlouběji', () => {
    expect(airDive(45, 30, 20, 85).firstStopM).toBeGreaterThan(airDive(45, 30, 80, 85).firstStopM);
  });
  it('delší nebo hlubší ponor znamená víc dekomprese', () => {
    expect(airDive(45, 40, 30, 85).ascentMin).toBeGreaterThan(airDive(45, 30, 30, 85).ascentMin);
    expect(airDive(51, 30, 30, 85).ascentMin).toBeGreaterThan(airDive(45, 30, 30, 85).ascentMin);
  });
  it('dekompresní plyn zkracuje výstup a přepíná se v zadané hloubce', () => {
    const base = { depthM: 45, bottomMinutes: 30, gfLow: 30, gfHigh: 85 };
    const airOnly = planDive({ ...base, gases: [{ gas: AIR }] });
    const withEan50 = planDive({ ...base, gases: [{ gas: AIR }, { gas: EAN50, switchDepthM: 21 }] });
    const withBoth = planDive({ ...base, gases: [{ gas: AIR }, { gas: EAN50, switchDepthM: 21 }, { gas: OXYGEN, switchDepthM: 6 }] });
    expect(withEan50.ascentMin).toBeLessThan(airOnly.ascentMin);
    expect(withBoth.ascentMin).toBeLessThan(withEan50.ascentMin);
    expect(withBoth.samples.filter((s) => s.gasIndex === 1).every((s) => s.depthM <= 21 + 1e-6)).toBe(true);
    expect(withBoth.samples.filter((s) => s.gasIndex === 2).every((s) => s.depthM <= 6 + 1e-6)).toBe(true);
    expect(withBoth.samples.some((s) => s.gasIndex === 2)).toBe(true);
  });
  it('poslední zastávka v 6 m vynechá zastávku ve 3 m', () => {
    const plan = planDive({ depthM: 45, bottomMinutes: 30, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85, lastStopM: 6 });
    expect(plan.stops[plan.stops.length - 1]!.depthM).toBe(6);
    expect(plan.surfacingGfPercent).toBeLessThanOrEqual(85.01);
  });
  it('vzorky pokrývají celý ponor a čas v nich neklesá', () => {
    const plan = airDive(45, 30, 30, 85);
    expect(plan.samples[0]).toMatchObject({ t: 0, depthM: 0 });
    expect(plan.samples[plan.samples.length - 1]!.depthM).toBeCloseTo(0, 6);
    expect(plan.samples[plan.samples.length - 1]!.t).toBeCloseTo(plan.runtimeMin, 6);
    for (let i = 1; i < plan.samples.length; i++) expect(plan.samples[i]!.t).toBeGreaterThanOrEqual(plan.samples[i - 1]!.t);
  });
  it('minimální doba po přepnutí plynu se započítá', () => {
    const base = { depthM: 45, bottomMinutes: 12, gases: [{ gas: AIR }, { gas: EAN50, switchDepthM: 21 }], gfLow: 100, gfHigh: 100 };
    const without = planDive(base);
    const withSwitch = planDive({ ...base, switchMinutes: 1 });
    expect(withSwitch.stops.some((s) => s.depthM === 21 && s.gasIndex === 1)).toBe(true);
    expect(withSwitch.runtimeMin).toBeGreaterThanOrEqual(without.runtimeMin);
  });
  it('odmítne neplatné vstupy', () => {
    const base = { depthM: 30, bottomMinutes: 20, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85 };
    expect(() => planDive({ ...base, depthM: 0 })).toThrow(/hloubka/);
    expect(() => planDive({ ...base, bottomMinutes: 0 })).toThrow(/čas/);
    expect(() => planDive({ ...base, bottomMinutes: 1 })).toThrow(/kratší než sestup/);
    expect(() => planDive({ ...base, gfLow: 90 })).toThrow(/gradient/);
    expect(() => planDive({ ...base, gfLow: 0 })).toThrow(/gradient/);
    expect(() => planDive({ ...base, gases: [] })).toThrow(/plyn/);
    expect(() => planDive({ ...base, ascentRate: 0 })).toThrow(/rychlosti/);
    expect(() => planDive({ ...base, gases: [{ gas: { fO2: 0.8, fHe: 0.5 } }] })).toThrow();
    expect(() => planDive({ depthM: 150, bottomMinutes: 400, gases: [{ gas: AIR }], gfLow: 5, gfHigh: 5 })).toThrow(/výukový rozsah/);
  });
});

describe('srovnání s referencí', () => {
  it('Subsurface testMetric: 79 m / 30 min, Tx 15/45, EAN36 od 33 m, O2 od 6 m, GF 100/100 → 109 min', () => {
    // Zdroj: subsurface/tests/testplan.cpp (testMetric), očekávaný celkový čas 109 min.
    // Konvence Subsurface: sestup 23 m/min, výstup 30 ft/min, posledních 6 m 10 ft/min,
    // poslední zastávka v 6 m, slaná voda 1,03, 1 atm, minimální doba přepnutí 1 min.
    const plan = planDive({
      depthM: 79,
      bottomMinutes: 30,
      gases: [{ gas: trimix(15, 45) }, { gas: { fO2: 0.36, fHe: 0 }, switchDepthM: 33 }, { gas: OXYGEN, switchDepthM: 6 }],
      gfLow: 100,
      gfHigh: 100,
      descentRate: 23,
      ascentRate: 9.144,
      surfaceRate: 3.048,
      lastStopM: 6,
      switchMinutes: 1,
      env: SUBSURFACE_ENV,
    });
    console.info(`[deco] testMetric: vlastní výpočet ${plan.runtimeMin.toFixed(1)} min, Subsurface 109 min; zastávky ${plan.stops.map((s) => `${s.depthM}m:${s.minutes}`).join(' ')}`);
    expect(ambientBar(79, SUBSURFACE_ENV)).toBeCloseTo(8.993, 2);
    expect(Math.abs(plan.runtimeMin - 109)).toBeLessThanOrEqual(1);
    expect(new Set(plan.stops.map((s) => s.depthM)).size).toBe(plan.stops.length); // žádná hloubka dvakrát
    expect(plan.stops[plan.stops.length - 1]).toMatchObject({ depthM: 6, gasIndex: 2 });
  });
  it('výuková a referenční konvence dávají podobný výsledek', () => {
    const base = { depthM: 45, bottomMinutes: 30, gases: [{ gas: AIR }], gfLow: 30, gfHigh: 85 };
    expect(Math.abs(planDive(base).runtimeMin - planDive({ ...base, env: SUBSURFACE_ENV }).runtimeMin)).toBeLessThan(8);
    expect(TEACHING_ENV.barPerMeter).toBe(0.1);
  });
});
