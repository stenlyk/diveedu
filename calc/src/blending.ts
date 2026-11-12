import { assertNonNegative, assertPositive, CalcInputError } from './errors';
import { AIR, fN2, type Gas, validateGas } from './gas';

const EPS = 1e-9;

export interface BlendInput {
  /** Tlak a složení zbytku v lahvi (prázdná lahev: startBar 0). */
  startBar: number;
  startGas?: Gas;
  targetBar: number;
  targetGas: Gas;
  /** Plyn, kterým se doplňuje na konec (výchozí vzduch). */
  topGas?: Gas;
}

export interface BlendResult {
  /** Kolik barů helia, kyslíku a doplňovacího plynu přidat (v tomto pořadí). */
  heBar: number;
  o2Bar: number;
  topBar: number;
  /** Tlak na manometru po každém kroku. */
  afterHeBar: number;
  afterO2Bar: number;
  /** false = cílovou směs nelze namíchat bez upuštění zbytku. */
  feasible: boolean;
}

/**
 * Míchání parciálním tlakem pro ideální plyn (nitrox i trimix, i na zbytek).
 * Reálný plyn se při vysokých tlacích chová jinak – výsledek vždy ověř analýzou.
 */
export function partialPressureBlend(input: BlendInput): BlendResult {
  const startGas = input.startGas ?? AIR;
  const topGas = input.topGas ?? AIR;
  assertNonNegative(input.startBar, 'počáteční tlak');
  assertPositive(input.targetBar, 'cílový tlak');
  validateGas(input.targetGas);
  if (input.targetBar < input.startBar) {
    throw new CalcInputError('cílový tlak musí být vyšší než tlak zbytku');
  }

  const n2Needed = input.targetBar * fN2(input.targetGas) - input.startBar * fN2(startGas);
  const topN2 = fN2(topGas);
  let topBar: number;
  let feasible = true;
  if (topN2 > EPS) {
    topBar = n2Needed / topN2;
  } else {
    topBar = 0;
    if (Math.abs(n2Needed) > EPS) feasible = false;
  }

  const heBar = input.targetBar * input.targetGas.fHe - input.startBar * startGas.fHe - topBar * topGas.fHe;
  const o2Bar = input.targetBar * input.targetGas.fO2 - input.startBar * startGas.fO2 - topBar * topGas.fO2;
  if (topBar < -EPS || heBar < -EPS || o2Bar < -EPS) feasible = false;

  const clean = (value: number) => (Math.abs(value) < EPS ? 0 : value);
  return {
    heBar: clean(heBar),
    o2Bar: clean(o2Bar),
    topBar: clean(topBar),
    afterHeBar: input.startBar + heBar,
    afterO2Bar: input.startBar + heBar + o2Bar,
    feasible,
  };
}

export interface TopUpInput {
  startBar: number;
  startGas: Gas;
  endBar: number;
  topGas?: Gas;
}

/** Výsledná směs po doplnění lahve doplňovacím plynem (ideální plyn). */
export function topUp(input: TopUpInput): Gas {
  const topGas = input.topGas ?? AIR;
  assertNonNegative(input.startBar, 'počáteční tlak');
  assertPositive(input.endBar, 'koncový tlak');
  validateGas(input.startGas);
  validateGas(topGas);
  if (input.endBar < input.startBar) {
    throw new CalcInputError('koncový tlak musí být vyšší než počáteční');
  }
  const added = input.endBar - input.startBar;
  return {
    fO2: (input.startBar * input.startGas.fO2 + added * topGas.fO2) / input.endBar,
    fHe: (input.startBar * input.startGas.fHe + added * topGas.fHe) / input.endBar,
  };
}
