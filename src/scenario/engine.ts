/** Průchod rozhodovacím scénářem. Čistý reducer: stav plynu počítá calc, čas a volby přicházejí zvenku. */
import { sacBarPerMinute } from '@diveedu/calc';
import type { Scenario, ScenarioNode } from '../content/schema';

export interface Decision {
  nodeId: string;
  /** Text zvolené možnosti, nebo null při vypršení času. */
  choice: string | null;
  verdict: 'good' | 'ok' | 'bad';
  feedback: string;
  gasAfterBar: number;
}

export interface ScenarioState {
  nodeId: string;
  gasBar: number;
  elapsedMin: number;
  decisions: Decision[];
  finished?: { outcome: 'success' | 'partial' | 'fail'; text: string };
}

export const OUT_OF_GAS_TEXT = 'Došel plyn. Čas, který jsi ztratil špatnými rozhodnutími a stresovým dýcháním, už nešel vrátit.';

export function nodeOf(scenario: Scenario, nodeId: string): ScenarioNode {
  const node = scenario.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Scénář ${scenario.id}: neznámý uzel ${nodeId}`);
  return node;
}

export function startScenario(scenario: Scenario): ScenarioState {
  return { nodeId: scenario.start, gasBar: scenario.setup.startBar, elapsedMin: 0, decisions: [] };
}

/** Provede rozhodnutí (index možnosti) nebo vypršení času ('timeout'). */
export function decide(scenario: Scenario, state: ScenarioState, choice: number | 'timeout'): ScenarioState {
  if (state.finished) return state;
  const node = nodeOf(scenario, state.nodeId);
  const picked = choice === 'timeout'
    ? node.timeout && { text: null, verdict: 'bad' as const, ...node.timeout }
    : node.options[choice];
  if (!picked) throw new Error(`Scénář ${scenario.id}: neplatná volba v uzlu ${node.id}`);

  const drop = sacBarPerMinute(scenario.setup.sacLpm * picked.stress, scenario.setup.depthM, scenario.setup.tankLiters) * picked.minutes;
  const gasBar = Math.max(0, state.gasBar - drop);
  const next: ScenarioState = {
    nodeId: picked.next,
    gasBar,
    elapsedMin: state.elapsedMin + picked.minutes,
    decisions: [...state.decisions, { nodeId: node.id, choice: picked.text, verdict: picked.verdict, feedback: picked.feedback, gasAfterBar: gasBar }],
  };
  if (gasBar <= 0) return { ...next, finished: { outcome: 'fail', text: OUT_OF_GAS_TEXT } };
  const target = nodeOf(scenario, picked.next);
  return target.end ? { ...next, finished: target.end } : next;
}

export interface Debrief {
  good: number;
  ok: number;
  bad: number;
  /** Bezchybný průchod: úspěšný konec a žádné špatné rozhodnutí. */
  clean: boolean;
}

export function debrief(state: ScenarioState): Debrief {
  const count = (verdict: Decision['verdict']) => state.decisions.filter((d) => d.verdict === verdict).length;
  const bad = count('bad');
  return { good: count('good'), ok: count('ok'), bad, clean: state.finished?.outcome === 'success' && bad === 0 };
}
