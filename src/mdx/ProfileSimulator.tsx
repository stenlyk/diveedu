import { formatCs, gasLabel, type Gas, nitrox, OXYGEN, trimix } from '@diveedu/calc';
import { analyzePlan, type PlanGas, type PlanIssue, planDive } from '@diveedu/deco';
import { useMemo, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Button, SliderField } from '../components/ui';

interface Level { depth: number; minutes: number }
const TRAVEL: { label: string; gas?: PlanGas }[] = [
  { label: 'bez travel plynu' },
  { label: 'Tx 21/35 do 51 m', gas: { gas: trimix(21, 35), switchDepthM: 51, useOnDescent: true } },
  { label: 'EAN32 do 33 m', gas: { gas: nitrox(32), switchDepthM: 33, useOnDescent: true } },
];
const DECO1: { label: string; gas?: PlanGas }[] = [
  { label: 'žádný' },
  { label: 'EAN50 od 21 m', gas: { gas: nitrox(50), switchDepthM: 21 } },
  { label: 'Tx 50/15 od 21 m', gas: { gas: trimix(50, 15), switchDepthM: 21 } },
  { label: 'Tx 35/25 od 33 m', gas: { gas: trimix(35, 25), switchDepthM: 33 } },
];
const DECO2: { label: string; gas?: PlanGas }[] = [
  { label: 'žádný' },
  { label: 'kyslík od 6 m', gas: { gas: OXYGEN, switchDepthM: 6 } },
  { label: 'kyslík od 9 m (chyba)', gas: { gas: OXYGEN, switchDepthM: 9 } },
];
const PRESETS: { label: string; o2: number; he: number; levels: Level[]; travel: number; deco1: number; deco2: number }[] = [
  { label: 'Vzduch 45 m', o2: 21, he: 0, levels: [{ depth: 45, minutes: 25 }], travel: 0, deco1: 1, deco2: 0 },
  { label: 'Tx 18/45 60 m', o2: 18, he: 45, levels: [{ depth: 60, minutes: 20 }], travel: 0, deco1: 2, deco2: 1 },
  { label: 'Tx 10/70 90 m bez travel', o2: 10, he: 70, levels: [{ depth: 90, minutes: 15 }], travel: 0, deco1: 1, deco2: 1 },
  { label: 'Tx 10/70 90 m s travel', o2: 10, he: 70, levels: [{ depth: 90, minutes: 15 }], travel: 1, deco1: 3, deco2: 1 },
];
const GAS_COLORS = ['var(--text)', 'var(--accent)', 'var(--ok)', 'var(--warn)'];
const select = 'mt-1 min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-text';

function describe(issue: PlanIssue, name: (index: number) => string): string {
  switch (issue.kind) {
    case 'ppo2-high': return `${name(issue.gasIndex)}: ppO2 ${formatCs(issue.value, 2)} bar v ${formatCs(issue.depthM, 0)} m – nad limitem, směs je pod svou MOD.`;
    case 'hypoxic': return `${name(issue.gasIndex)}: ppO2 jen ${formatCs(issue.value, 2)} bar v ${formatCs(issue.depthM, 0)} m – hrozí hypoxie. Mělko dýchej travel gas.`;
    case 'end': return `${name(issue.gasIndex)}: narkotická hloubka ${formatCs(issue.value, 0)} m – víc než 30 m.`;
    case 'density': return `${name(issue.gasIndex)}: hustota ${formatCs(issue.value, 1)} g/l v ${formatCs(issue.depthM, 0)} m – nad tvrdým limitem 6,2 g/l.`;
    case 'icd': return `Přepnutí na ${name(issue.gasIndex)} v ${formatCs(issue.depthM, 0)} m: dusíku přibude ${formatCs(issue.value * 100, 0)} %, víc než pětina úbytku helia. Pravidlo pětin je přísná provozní konvence proti izobarické protidifuzi; viz lekci.`;
    case 'cns': return `CNS hodiny ${formatCs(issue.value, 0)} % – nad plánovacím limitem 80 %.`;
    case 'cns-off-table': return 'ppO2 přesáhlo 1,6 bar – mimo tabulku limitů NOAA; CNS zátěž nejde spočítat.';
    case 'ceiling': return `Přesun na úroveň ${formatCs(issue.depthM, 0)} m je ${formatCs(issue.value, 0)} m nad dekompresním stropem.`;
  }
}

/**
 * Simulátor profilu ponoru: úrovně, plyny a GF → rozvrh z výukového modelu a varování MOD / hypoxie / ICD / CNS / hustota.
 * Výhradně výukový; není to plánovač ponorů.
 */
export function ProfileSimulator() {
  const [levels, setLevels] = useState<Level[]>([{ depth: 60, minutes: 20 }]);
  const [o2, setO2] = useState(18);
  const [he, setHe] = useState(45);
  const [travel, setTravel] = useState(0);
  const [deco1, setDeco1] = useState(2);
  const [deco2, setDeco2] = useState(1);
  const [gfLow, setGfLow] = useState(50);
  const [gfHigh, setGfHigh] = useState(80);

  const fHe = Math.min(he, 100 - o2);
  const result = useMemo(() => {
    const bottom: Gas = { fO2: o2 / 100, fHe: fHe / 100 };
    const gases: PlanGas[] = [{ gas: bottom }, ...[TRAVEL[travel]!.gas, DECO1[deco1]!.gas, DECO2[deco2]!.gas].filter((g): g is PlanGas => g !== undefined)];
    const [first, ...rest] = levels;
    try {
      const plan = planDive({ depthM: first!.depth, bottomMinutes: Math.max(first!.minutes, Math.ceil(first!.depth / 20)), gases, levels: rest.map((l) => ({ depthM: l.depth, minutes: l.minutes })), gfLow: Math.min(gfLow, gfHigh), gfHigh });
      return { gases, plan, analysis: analyzePlan(plan, gases) };
    } catch (error) {
      return { gases, error: (error as Error).message };
    }
  }, [levels, o2, fHe, travel, deco1, deco2, gfLow, gfHigh]);

  const setLevel = (index: number, patch: Partial<Level>) => setLevels(levels.map((level, i) => (i === index ? { ...level, ...patch } : level)));
  const applyPreset = (preset: (typeof PRESETS)[number]) => { setLevels(preset.levels); setO2(preset.o2); setHe(preset.he); setTravel(preset.travel); setDeco1(preset.deco1); setDeco2(preset.deco2); };
  const name = (index: number) => gasLabel(result.gases[index]!.gas);

  const W = 320;
  const H = 130;
  const { plan, analysis } = result;
  const maxDepth = Math.max(...levels.map((l) => l.depth));
  const tx = (t: number) => (plan ? (t / plan.runtimeMin) * W : 0);
  const dy = (d: number) => 6 + (d / maxDepth) * (H - 12);

  return (
    <div className="space-y-5" data-testid="profile-sim">
      <Disclaimer kind="deco" />
      <div className="flex flex-wrap gap-2" aria-label="Připravené ponory">
        {PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="min-h-11 rounded-full border border-border px-4 text-sm hover:border-accent">{preset.label}</button>)}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {levels.map((level, i) => (
            <fieldset key={i} className="space-y-3 rounded-2xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold">{i === 0 ? 'Dno' : `${i + 1}. úroveň`}</legend>
              <SliderField label={`Hloubka ${i + 1}`} value={level.depth} min={9} max={120} step={3} unit="m" onChange={(depth) => setLevel(i, { depth })} />
              <SliderField label={`Čas ${i + 1}`} value={level.minutes} min={i === 0 ? 5 : 0} max={60} step={5} unit="min" onChange={(minutes) => setLevel(i, { minutes })} />
              {i > 0 && <Button variant="ghost" className="!min-h-11 !px-0" onClick={() => setLevels(levels.filter((_, j) => j !== i))}>Odebrat úroveň</Button>}
            </fieldset>
          ))}
          {levels.length < 3 && <Button variant="secondary" onClick={() => setLevels([...levels, { depth: Math.max(9, levels[levels.length - 1]!.depth - 15), minutes: 10 }])}>Přidat úroveň</Button>}
          <SliderField label="Dno směs: kyslík" value={o2} min={8} max={40} step={1} unit="%" onChange={(value) => { setO2(value); setHe(Math.min(he, 100 - value)); }} />
          <SliderField label="Dno směs: helium" value={fHe} min={0} max={100 - o2} step={5} unit="%" onChange={setHe} />
          <label className="block text-sm text-muted">Travel gas na sestup
            <select className={select} value={travel} onChange={(event) => setTravel(Number(event.target.value))}>{TRAVEL.map((option, i) => <option key={option.label} value={i}>{option.label}</option>)}</select>
          </label>
          <label className="block text-sm text-muted">První dekompresní plyn
            <select className={select} value={deco1} onChange={(event) => setDeco1(Number(event.target.value))}>{DECO1.map((option, i) => <option key={option.label} value={i}>{option.label}</option>)}</select>
          </label>
          <label className="block text-sm text-muted">Druhý dekompresní plyn
            <select className={select} value={deco2} onChange={(event) => setDeco2(Number(event.target.value))}>{DECO2.map((option, i) => <option key={option.label} value={i}>{option.label}</option>)}</select>
          </label>
          <SliderField label="GF low" value={gfLow} min={10} max={100} step={5} unit="%" onChange={setGfLow} />
          <SliderField label="GF high" value={gfHigh} min={50} max={100} step={5} unit="%" onChange={setGfHigh} />
        </div>

        <div>
          {!plan || !analysis ? (
            <p className="text-danger" role="status">Tento ponor je mimo rozsah výukového modelu: {result.error}.</p>
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-surface-2" role="img" aria-label={`Profil ponoru do ${maxDepth} m, celkem ${formatCs(plan.runtimeMin, 0)} minut`}>
                <polygon points={`0,6 ${plan.samples.map((s) => `${tx(s.t).toFixed(1)},${dy(s.ceilingM).toFixed(1)}`).join(' ')} ${W},6`} fill="var(--danger)" fillOpacity="0.22" />
                {plan.samples.slice(1).map((sample, i) => {
                  const previous = plan.samples[i]!;
                  return <line key={i} x1={tx(previous.t)} y1={dy(previous.depthM)} x2={tx(sample.t)} y2={dy(sample.depthM)} stroke={GAS_COLORS[sample.gasIndex % GAS_COLORS.length]} strokeWidth="2" strokeLinecap="round" />;
                })}
                {analysis.switches.map((change, i) => <circle key={i} cx={tx(change.t)} cy={dy(change.depthM)} r="4" fill={change.icdOk ? 'var(--surface)' : 'var(--danger)'} stroke="var(--text)" strokeWidth="1.5" />)}
              </svg>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {result.gases.map((entry, i) => <span key={i}><span style={{ color: GAS_COLORS[i % GAS_COLORS.length] }}>━</span> {gasLabel(entry.gas)}</span>)}
                <span>○ přepnutí plynu</span><span>červená plocha: nad stropem</span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Celkem</dt><dd className="text-lg font-bold tabular-nums" data-testid="profile-runtime">{formatCs(plan.runtimeMin, 0)} min</dd></div>
                <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Výstup</dt><dd className="text-lg font-bold tabular-nums">{formatCs(plan.ascentMin, 0)} min</dd></div>
                <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">CNS</dt><dd className="text-lg font-bold tabular-nums" data-testid="profile-cns">{analysis.cnsPercent === null ? 'mimo tabulku' : `${formatCs(analysis.cnsPercent, 0)} %`}</dd></div>
                <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">OTU</dt><dd className="text-lg font-bold tabular-nums">{formatCs(analysis.otu, 0)}</dd></div>
              </dl>
              <div className={`mt-3 rounded-2xl border-2 p-3 ${analysis.issues.length === 0 ? 'border-ok' : 'border-danger'}`} role="status" data-testid="profile-issues">
                {analysis.issues.length === 0 ? (
                  <p className="font-semibold text-ok">✓ Model nenašel v plánu žádnou výhradu.</p>
                ) : (
                  <>
                    <p className="font-semibold text-danger">Výhrady k plánu ({analysis.issues.length})</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{analysis.issues.map((issue, i) => <li key={i} data-issue={issue.kind}>{describe(issue, name)}</li>)}</ul>
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-muted">
                {plan.stops.length === 0 ? 'Bez zastávek.' : `Zastávky: ${plan.stops.map((stop) => `${stop.depthM} m / ${stop.minutes} min (${name(stop.gasIndex)})`).join(' · ')}`}
              </p>
              <p className="mt-2 text-xs text-muted">Nejvyšší ppO2 {formatCs(analysis.maxPpO2Bar, 2)} bar · nejnižší ppO2 {formatCs(analysis.minPpO2Bar, 2)} bar · nejvyšší END {formatCs(analysis.maxEndM, 0)} m · nejvyšší hustota {formatCs(analysis.maxDensityGL, 1)} g/l</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
