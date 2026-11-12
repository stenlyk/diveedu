import { assertPositive } from './errors';

/**
 * Prostředí ponoru. Výchozí je metrická konvence 10 m mořské vody = 1 bar
 * a tlak 1 bar na hladině. Sladká voda ≈ 10,3 m/bar; ve výšce je surfaceBar < 1.
 */
export interface Env {
  /** Kolik metrů vodního sloupce odpovídá 1 baru. */
  metersPerBar: number;
  /** Atmosférický tlak na hladině v barech. */
  surfaceBar: number;
}

export const DEFAULT_ENV: Env = Object.freeze({ metersPerBar: 10, surfaceBar: 1 });
export const FRESH_WATER_ENV: Env = Object.freeze({ metersPerBar: 10.3, surfaceBar: 1 });

export function validateEnv(env: Env): void {
  assertPositive(env.metersPerBar, 'metersPerBar');
  assertPositive(env.surfaceBar, 'surfaceBar');
}
