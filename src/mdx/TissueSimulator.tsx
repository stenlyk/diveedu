import { AIR, EAN50, formatCs, gasLabel, nitrox, OXYGEN } from '@diveedu/calc';
import { ambientBar, coefficients, COMPARTMENTS, type EducationalPlan, mValue, N2_HALF_TIMES, planDive, type PlanGas, TEACHING_ENV } from '@diveedu/deco';
import { useEffect, useMemo, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Button, SliderField } from '../components/ui';

const BOTTOM_GASES = [{ label: 'vzduch', gas: AIR }, { label: 'EAN32', gas: nitrox(32) }];
const DECO_OPTIONS: { label: string; gases: PlanGas[] }[] = [
  { label: 'bez dekompresního plynu', gases: [] },
  { label: 'EAN50 od 21 m', gases: [{ gas: EAN50, switchDepthM: 21 }] },
  { label: 'EAN50 od 21 m + O2 od 6 m', gases: [{ gas: EAN50, switchDepthM: 21 }, { gas: OXYGEN, switchDepthM: 6 }] },
];

const select = 'min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3';

/**
 * Tkáňový simulátor: 16 kompartmentů v čase, okolní tlak proti tlaku v tkáni s přímkou M-hodnot a GF.
 * Výhradně výukový – výstup modelu není plán ponoru.
 */
export function TissueSimulator() {
  const [depth, setDepth] = useState(40);
  const [bottom, setBottom] = useState(25);
  const [gfLow, setGfLow] = useState(30);
  const [gfHigh, setGfHigh] = useState(85);
  const [bottomGas, setBottomGas] = useState(0);
  const [deco, setDeco] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const result = useMemo((): { plan?: EducationalPlan; error?: string; gases: PlanGas[] } => {
    const gases: PlanGas[] = [{ gas: BOTTOM_GASES[bottomGas]!.gas }, ...DECO_OPTIONS[deco]!.gases];
    try {
      return { plan: planDive({ depthM: depth, bottomMinutes: bottom, gases, gfLow: Math.min(gfLow, gfHigh), gfHigh }), gases };
    } catch (error) {
      return { error: (error as Error).message, gases };
    }
  }, [depth, bottom, gfLow, gfHigh, bottomGas, deco]);
  const plan = result.plan;
  const last = plan ? plan.samples.length - 1 : 0;

  useEffect(() => { setCursor(0); setPlaying(false); }, [plan]);
  useEffect(() => {
    if (!playing || !plan) return;
    const timer = setInterval(() => setCursor((value) => { if (value >= last) { setPlaying(false); return value; } return value + 1; }), 90);
    return () => clearInterval(timer);
  }, [playing, plan, last]);

  const controls = (
    <div className="space-y-4">
      <SliderField label="Hloubka" value={depth} min={18} max={60} step={3} unit="m" onChange={setDepth} />
      <SliderField label="Čas na dně" value={bottom} min={5} max={50} step={5} unit="min" onChange={setBottom} />
      <SliderField label="GF low" value={gfLow} min={10} max={100} step={5} unit="%" onChange={setGfLow} />
      <SliderField label="GF high" value={gfHigh} min={50} max={100} step={5} unit="%" onChange={setGfHigh} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">Plyn na dně
          <select className={select} value={bottomGas} onChange={(event) => setBottomGas(Number(event.target.value))}>{BOTTOM_GASES.map((option, i) => <option key={option.label} value={i}>{option.label}</option>)}</select>
        </label>
        <label className="text-sm text-muted">Dekomprese
          <select className={select} value={deco} onChange={(event) => setDeco(Number(event.target.value))}>{DECO_OPTIONS.map((option, i) => <option key={option.label} value={i}>{option.label}</option>)}</select>
        </label>
      </div>
    </div>
  );

  if (!plan) {
    return <div className="space-y-4" data-testid="tissue-sim"><Disclaimer kind="deco" />{controls}<p className="text-danger" role="status">Tento ponor je mimo rozsah výukového modelu: {result.error}.</p></div>;
  }

  const sample = plan.samples[Math.min(cursor, last)]!;
  const ambient = ambientBar(sample.depthM, TEACHING_ENV);
  const surface = TEACHING_ENV.surfaceBar;
  const maxAmbient = ambientBar(depth, TEACHING_ENV);
  const loads = Array.from({ length: COMPARTMENTS }, (_, i) => ({ inert: coefficients(sample.tissues, i).inert, m: mValue(sample.tissues, i, ambient) }));
  const scaleMax = Math.max(maxAmbient, ...plan.samples.map((s) => Math.max(...s.tissues.n2.map((p, i) => p + s.tissues.he[i]!)))) * 1.08;

  // Profil: hloubka a strop v čase.
  const W = 320;
  const H = 110;
  const tx = (t: number) => (t / plan.runtimeMin) * W;
  const dy = (d: number) => 6 + (d / depth) * (H - 12);
  const profile = plan.samples.map((s) => `${tx(s.t).toFixed(1)},${dy(s.depthM).toFixed(1)}`).join(' ');
  const ceiling = plan.samples.map((s) => `${tx(s.t).toFixed(1)},${dy(s.ceilingM).toFixed(1)}`).join(' ');

  // Graf tlaků: vodorovně okolní tlak, svisle tlak inertního plynu ve vedoucím kompartmentu.
  const G = 200;
  const lead = sample.leadingCompartment;
  const px = (p: number) => (p / scaleMax) * G;
  const py = (p: number) => G - (p / scaleMax) * G;
  const mLine = (p: number) => mValue(sample.tissues, lead, p);
  const firstStopBar = ambientBar(plan.firstStopM, TEACHING_ENV);
  const gfLimit = (p: number, gf: number) => p + (gf / 100) * (mLine(p) - p);
  const trail = plan.samples.slice(0, cursor + 1).map((s) => `${px(ambientBar(s.depthM, TEACHING_ENV)).toFixed(1)},${py(coefficients(s.tissues, lead).inert).toFixed(1)}`).join(' ');

  return (
    <div className="space-y-5" data-testid="tissue-sim">
      <Disclaimer kind="deco" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {controls}
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-surface-2" role="img" aria-label={`Profil ponoru: ${depth} m, celkem ${formatCs(plan.runtimeMin, 0)} minut`}>
            <polygon points={`0,6 ${ceiling} ${W},6`} fill="var(--danger)" fillOpacity="0.25" />
            <polyline points={profile} fill="none" stroke="var(--text)" strokeWidth="1.5" />
            <line x1={tx(sample.t)} x2={tx(sample.t)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="1.5" />
          </svg>
          <p className="mt-1 text-xs text-muted">Bílá čára: hloubka v čase. Červená plocha: pásmo nad stropem, kam v danou chvíli nelze vystoupat.</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Výstup</dt><dd className="text-lg font-semibold tabular-nums" data-testid="sim-ascent">{formatCs(plan.ascentMin, 0)} min</dd></div>
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">První zastávka</dt><dd className="text-lg font-semibold tabular-nums">{plan.firstStopM} m</dd></div>
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">GF na hladině</dt><dd className="text-lg font-semibold tabular-nums">{formatCs(plan.surfacingGfPercent, 0)} %</dd></div>
          </dl>
          <p className="mt-2 text-sm text-muted" data-testid="sim-stops">
            {plan.stops.length === 0 ? 'Bez zastávek.' : `Zastávky: ${plan.stops.map((stop) => `${stop.depthM} m / ${stop.minutes} min`).join(' · ')}`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="!min-h-12" onClick={() => { if (cursor >= last) setCursor(0); setPlaying(!playing); }}>{playing ? '❚❚ Pauza' : '▶ Přehrát'}</Button>
          <label className="flex min-w-48 flex-1 items-center gap-2 text-sm text-muted">Čas
            <input type="range" min={0} max={last} value={cursor} onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }} aria-label="Čas ponoru" />
          </label>
        </div>
        <p className="mt-2 text-sm tabular-nums" data-testid="sim-now">
          {formatCs(sample.t, 0)}. minuta · {formatCs(sample.depthM, 0)} m · {gasLabel(result.gases[sample.gasIndex]!.gas)} · strop {formatCs(sample.ceilingM, 0)} m · GF99 {formatCs(Math.max(0, sample.gf99), 0)} % (kompartment {lead + 1})
        </p>

        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
          <div>
            <h3 className="mb-2 text-sm font-semibold">16 kompartmentů: tlak inertního plynu</h3>
            <div className="relative flex h-44 items-end gap-1" role="img" aria-label={`Nejvíc zatížený je kompartment ${lead + 1}`}>
              {loads.map((load, i) => {
                const over = load.inert > ambient;
                const near = (load.inert - ambient) / (load.m - ambient) > Math.min(gfLow, gfHigh) / 100;
                return (
                  <div key={i} className="relative h-full flex-1">
                    <div className="absolute inset-x-0 bottom-0 rounded-t" style={{ height: `${(load.inert / scaleMax) * 100}%`, background: !over ? 'var(--ok)' : near ? 'var(--warn)' : 'var(--accent)', outline: i === lead ? '2px solid var(--text)' : undefined }} />
                    <div className="absolute inset-x-0 h-0.5 bg-danger" style={{ bottom: `${Math.min(100, (load.m / scaleMax) * 100)}%` }} />
                  </div>
                );
              })}
              {/* Okolní tlak se kreslí až nad sloupci, aby byl vidět přes ně. */}
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-text" style={{ bottom: `${(ambient / scaleMax) * 100}%` }} />
            </div>
            <div className="mt-1 flex gap-1 text-center text-[10px] text-muted">{N2_HALF_TIMES.map((half, i) => <span key={half} className="flex-1">{i % 3 === 0 ? `${half}'` : ''}</span>)}</div>
            <p className="mt-2 text-xs text-muted">Čárkovaně okolní tlak. Zelený sloupec se sytí, modrý a žlutý plyn vydává. Červená čárka je M-hodnota kompartmentu. Zleva rychlé tkáně (poločas 5 min), vpravo pomalé (635 min).</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Vedoucí kompartment {lead + 1}: tkáň proti okolí</h3>
            <svg viewBox={`-22 -6 ${G + 30} ${G + 26}`} className="w-full max-w-xs" role="img" aria-label="Graf okolního tlaku proti tlaku v tkáni s přímkou M-hodnot">
              <rect x="0" y="0" width={G} height={G} fill="var(--surface-2)" />
              <line x1={px(surface)} y1="0" x2={px(surface)} y2={G} stroke="var(--border)" strokeDasharray="3 3" />
              <line x1={px(0)} y1={py(0)} x2={px(scaleMax)} y2={py(scaleMax)} stroke="var(--muted)" strokeWidth="1.5" />
              <line x1={px(surface)} y1={py(mLine(surface))} x2={px(scaleMax)} y2={py(mLine(scaleMax))} stroke="var(--danger)" strokeWidth="1.5" />
              {plan.firstStopM > 0 && <line x1={px(surface)} y1={py(gfLimit(surface, gfHigh))} x2={px(firstStopBar)} y2={py(gfLimit(firstStopBar, Math.min(gfLow, gfHigh)))} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="5 3" />}
              <polyline points={trail} fill="none" stroke="var(--accent)" strokeWidth="2" />
              <circle cx={px(ambient)} cy={py(loads[lead]!.inert)} r="4" fill="var(--accent)" />
              <text x={G / 2} y={G + 16} fontSize="9" textAnchor="middle" fill="var(--muted)">okolní tlak →</text>
              <text x="-14" y={G / 2} fontSize="9" textAnchor="middle" fill="var(--muted)" transform={`rotate(-90 -14 ${G / 2})`}>tlak v tkáni →</text>
              <text x={px(surface) + 2} y="9" fontSize="8" fill="var(--muted)">hladina</text>
            </svg>
            <p className="mt-2 text-xs text-muted">Šedá úhlopříčka: tkáň = okolí. Červená: M-hodnoty. Žlutá čárkovaná: limit daný GF low (u první zastávky) až GF high (na hladině). Modrá stopa nesmí žlutou čáru překročit.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
