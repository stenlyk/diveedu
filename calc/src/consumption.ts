import { assertNonNegative, assertPositive, CalcInputError } from './errors';
import { DEFAULT_ENV, type Env } from './env';
import { absPressure } from './pressure';

/** Spotřeba plynu v litrech (při 1 bar). Spotřeba = SAC · P_abs · čas */
export function gasConsumed(
  sacLpm: number,
  depthM: number,
  minutes: number,
  env: Env = DEFAULT_ENV,
): number {
  assertNonNegative(sacLpm, 'SAC');
  assertNonNegative(minutes, 'čas');
  return sacLpm * absPressure(depthM, env) * minutes;
}

export function litersToBar(liters: number, tankLiters: number): number {
  assertNonNegative(liters, 'objem plynu');
  assertPositive(tankLiters, 'objem lahve');
  return liters / tankLiters;
}

export function barToLiters(bar: number, tankLiters: number): number {
  assertNonNegative(bar, 'tlak');
  assertPositive(tankLiters, 'objem lahve');
  return bar * tankLiters;
}

export interface DiveLog {
  startBar: number;
  endBar: number;
  tankLiters: number;
  avgDepthM: number;
  minutes: number;
}

/** Povrchová spotřeba (SAC/RMV) v l/min z logu ponoru. */
export function sacFromLog(log: DiveLog, env: Env = DEFAULT_ENV): number {
  assertNonNegative(log.endBar, 'koncový tlak');
  assertPositive(log.minutes, 'čas');
  if (log.startBar < log.endBar) {
    throw new CalcInputError('počáteční tlak musí být vyšší než koncový');
  }
  const liters = barToLiters(log.startBar - log.endBar, log.tankLiters);
  return liters / (absPressure(log.avgDepthM, env) * log.minutes);
}

export interface Stop {
  depthM: number;
  minutes: number;
}

export interface RockBottomInput {
  depthM: number;
  /** Stresová spotřeba jednoho potápěče v l/min. */
  sacLpm: number;
  /** Počet potápěčů dýchajících ze zásoby (výchozí 2). */
  divers?: number;
  /** Čas na vyřešení problému v hloubce (výchozí 1 min). */
  solveMinutes?: number;
  /** Rychlost výstupu v m/min (výchozí 9). */
  ascentRateMpm?: number;
  /** Zastávky během výstupu. */
  stops?: readonly Stop[];
}

/**
 * Rock bottom / minimum gas v litrech: plyn pro vyřešení problému v hloubce,
 * výstup průměrnou hloubkou a zastávky, pro daný počet potápěčů.
 * Konvence se mezi agenturami liší (čas na řešení, rychlost, zastávky) – proto jsou to parametry.
 */
export function rockBottom(input: RockBottomInput, env: Env = DEFAULT_ENV): number {
  const divers = input.divers ?? 2;
  const solveMinutes = input.solveMinutes ?? 1;
  const ascentRateMpm = input.ascentRateMpm ?? 9;
  const stops = input.stops ?? [];
  assertPositive(divers, 'počet potápěčů');
  assertPositive(ascentRateMpm, 'rychlost výstupu');

  const atDepth = gasConsumed(input.sacLpm, input.depthM, solveMinutes, env);
  const ascent = gasConsumed(input.sacLpm, input.depthM / 2, input.depthM / ascentRateMpm, env);
  const atStops = stops.reduce(
    (sum, stop) => sum + gasConsumed(input.sacLpm, stop.depthM, stop.minutes, env),
    0,
  );
  return divers * (atDepth + ascent + atStops);
}

export interface Thirds {
  /** Plyn na cestu dovnitř (bar). */
  usableBar: number;
  /** Tlak, při kterém se ponor otáčí. */
  turnBar: number;
}

/** Pravidlo třetin, přesně: třetina dovnitř, otočka na dvou třetinách. */
export function ruleOfThirds(startBar: number): Thirds {
  assertNonNegative(startBar, 'počáteční tlak');
  const usableBar = startBar / 3;
  return { usableBar, turnBar: startBar - usableBar };
}

/**
 * Pravidlo třetin, jak se počítá v praxi: třetina zaokrouhlená dolů na celé
 * desítky barů (200 bar → 60 bar dovnitř, otočka na 140).
 */
export function ruleOfThirdsPractical(startBar: number, stepBar = 10): Thirds {
  assertNonNegative(startBar, 'počáteční tlak');
  assertPositive(stepBar, 'krok');
  const usableBar = Math.floor(startBar / 3 / stepBar + 1e-9) * stepBar;
  return { usableBar, turnBar: startBar - usableBar };
}

/** Tlak otočky pro libovolný podíl použitelného plynu (např. 1/4, 1/6). */
export function turnPressure(startBar: number, usableFraction: number): number {
  assertNonNegative(startBar, 'počáteční tlak');
  if (!(usableFraction >= 0 && usableFraction <= 1)) {
    throw new CalcInputError('podíl použitelného plynu musí být 0–1');
  }
  return startBar * (1 - usableFraction);
}

export interface TeamDiver {
  tankLiters: number;
  startBar: number;
  sacLpm: number;
}

export interface TeamDiverTurn {
  usableLiters: number;
  usableBar: number;
  turnBar: number;
}

export interface TeamTurn {
  a: TeamDiverTurn;
  b: TeamDiverTurn;
  /** Kdo z dvojice určuje otočku. */
  limitedBy: 'a' | 'b';
}

/**
 * Otočka pro dvojici s různými lahvemi nebo různou spotřebou.
 * Podmínky: (1) nikdo nespotřebuje dovnitř víc než svou třetinu,
 * (2) zásoba každého po otočce stačí na cestu ven pro oba (sdílení plynu od nejvzdálenějšího bodu).
 * Předpokládá stejnou dobu cesty dovnitř i ven (bez proudu).
 */
export function teamTurnPressure(a: TeamDiver, b: TeamDiver): TeamTurn {
  for (const diver of [a, b]) {
    assertPositive(diver.tankLiters, 'objem lahve');
    assertNonNegative(diver.startBar, 'počáteční tlak');
    assertPositive(diver.sacLpm, 'SAC');
  }
  const volumeA = a.tankLiters * a.startBar;
  const volumeB = b.tankLiters * b.startBar;
  // „Čas“ cesty dovnitř vyjádřený v minutách na hladině (tlakový faktor je pro oba stejný).
  const limitA = Math.min(volumeA / (3 * a.sacLpm), volumeA / (2 * a.sacLpm + b.sacLpm));
  const limitB = Math.min(volumeB / (3 * b.sacLpm), volumeB / (2 * b.sacLpm + a.sacLpm));
  const time = Math.min(limitA, limitB);
  const turn = (diver: TeamDiver): TeamDiverTurn => {
    const usableLiters = diver.sacLpm * time;
    const usableBar = usableLiters / diver.tankLiters;
    return { usableLiters, usableBar, turnBar: diver.startBar - usableBar };
  };
  return { a: turn(a), b: turn(b), limitedBy: limitA <= limitB ? 'a' : 'b' };
}
