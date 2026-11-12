import { type CalcStep, texResult } from '@diveedu/calc';
import { Tex } from './Math';

/** Rozepsaný postup výpočtu z funkcí …Steps() v calc. Mezivýsledky se nezaokrouhlují víc než na 3 místa. */
export function Steps({ steps, decimals = 3 }: { steps: CalcStep[]; decimals?: number }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="rounded-xl bg-surface-2 px-4 py-3">
          <div className="text-sm text-muted">{index + 1}. {step.label}</div>
          <div className="overflow-x-auto">
            <Tex block tex={`${step.latex} = ${texResult(step.value, step.unit, decimals)}`} />
          </div>
        </li>
      ))}
    </ol>
  );
}
