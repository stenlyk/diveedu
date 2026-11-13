import { checkMix, formatCs, gasLabel } from '@diveedu/calc';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Button, SliderField } from '../components/ui';

const W = 300;
const H = 240;
const STEP = 0.02;

/**
 * Ternární diagram směsi O2 / He / N2. Pro zadanou hloubku a limity vybarví oblast povolených směsí;
 * bod lze táhnout nebo nastavit posuvníky. Hodnocení každé směsi počítá calc.checkMix.
 */
export function TernaryDiagram() {
  const [depth, setDepth] = useState(60);
  const [ppMax, setPpMax] = useState(1.4);
  const [endMax, setEndMax] = useState(30);
  const [o2Narcotic, setO2Narcotic] = useState(true);
  const [detail, setDetail] = useState(true);
  const [o2, setO2] = useState(18);
  const [he, setHe] = useState(45);
  const svgRef = useRef<SVGSVGElement>(null);

  const limits = useMemo(() => ({ ppO2MinBar: 0.18, ppO2MaxBar: ppMax, endMaxM: endMax, densityMaxGL: 6.2, o2Narcotic }), [ppMax, endMax, o2Narcotic]);
  const maxO2 = detail ? 0.4 : 1;
  // Vrcholy: helium vlevo dole, dusík vpravo dole, kyslík nahoře.
  const position = (fO2: number, fHe: number) => ({ x: W * (1 - fO2 - fHe + fO2 / 2), y: H * (1 - fO2 / maxO2) });

  const cells = useMemo(() => {
    const out: { x: number; y: number; state: 'ok' | 'dense' | 'bad' }[] = [];
    for (let a = 0; a <= maxO2 + 1e-9; a += STEP) {
      for (let b = 0; a + b <= 1 + 1e-9; b += STEP) {
        const check = checkMix({ fO2: a, fHe: Math.min(b, 1 - a) }, depth, limits);
        const { x, y } = position(a, b);
        out.push({ x, y, state: !check.allowed ? 'bad' : check.densityGL > 5.2 ? 'dense' : 'ok' });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, limits, maxO2]);

  const fO2 = o2 / 100;
  const fHe = Math.min(he, 100 - o2) / 100;
  const mix = { fO2, fHe };
  const check = checkMix(mix, depth, limits);
  const point = position(Math.min(fO2, maxO2), fHe);

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || (event.type === 'pointermove' && event.buttons === 0)) return;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * (W + 20) - 10;
    const y = ((event.clientY - box.top) / box.height) * (H + 30) - 10;
    const pickedO2 = Math.max(0, Math.min(maxO2, (1 - y / H) * maxO2));
    const pickedN2 = Math.max(0, Math.min(1 - pickedO2, x / W - pickedO2 / 2));
    const nextO2 = Math.round(pickedO2 * 100);
    setO2(Math.max(5, nextO2));
    setHe(Math.max(0, Math.round((1 - pickedO2 - pickedN2) * 100)));
  };

  const problems = [
    check.hypoxic && 'na hladině nedýchatelná – ppO2 pod 0,18 bar už v této hloubce',
    check.ppO2TooHigh && `ppO2 nad limitem ${formatCs(ppMax, 1)} bar`,
    check.endTooDeep && `END hlubší než ${endMax} m`,
    check.tooDense && 'hustota nad 6,2 g/l',
  ].filter(Boolean);
  const fill = { ok: 'var(--ok)', dense: 'var(--warn)', bad: 'var(--border)' } as const;

  return (
    <div className="space-y-4" data-testid="ternary">
      <Disclaimer kind="calc" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <SliderField label="Hloubka" value={depth} min={30} max={100} step={5} unit="m" onChange={setDepth} />
          <SliderField label="Limit ppO2" value={ppMax} min={1} max={1.6} step={0.1} unit="bar" onChange={setPpMax} />
          <SliderField label="Nejvyšší END" value={endMax} min={20} max={40} step={1} unit="m" onChange={setEndMax} />
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={o2Narcotic} onChange={(event) => setO2Narcotic(event.target.checked)} />
            Počítat kyslík jako narkotický
          </label>
          <SliderField label="Kyslík ve směsi" value={o2} min={5} max={detail ? 40 : 100} step={1} unit="%" onChange={(value) => { setO2(value); setHe(Math.min(he, 100 - value)); }} />
          <SliderField label="Helium ve směsi" value={Math.min(he, 100 - o2)} min={0} max={100 - o2} step={1} unit="%" onChange={setHe} />
        </div>
        <div>
          <svg ref={svgRef} viewBox={`-10 -10 ${W + 20} ${H + 30}`} className="w-full touch-none rounded-xl bg-surface-2" role="img" aria-label={`Ternární diagram pro ${depth} m; vybraná směs ${gasLabel(mix)} je ${check.allowed ? 'povolená' : 'mimo limity'}`} onPointerDown={pick} onPointerMove={pick}>
            {cells.map((cell, i) => <circle key={i} cx={cell.x} cy={cell.y} r={detail ? 2.6 : 1.9} fill={fill[cell.state]} fillOpacity={cell.state === 'bad' ? 0.5 : 0.9} />)}
            <circle cx={point.x} cy={point.y} r="7" fill="none" stroke="var(--text)" strokeWidth="2.5" />
            <circle cx={point.x} cy={point.y} r="2.5" fill="var(--text)" />
            <text x="0" y={H + 14} fontSize="10" fill="var(--muted)">100 % He</text>
            <text x={W} y={H + 14} fontSize="10" textAnchor="end" fill="var(--muted)">100 % N2</text>
            <text x={W / 2} y="0" fontSize="10" textAnchor="middle" fill="var(--muted)">{detail ? '40 % O2' : '100 % O2'}</text>
          </svg>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span><span style={{ color: 'var(--ok)' }}>●</span> povolené, hustota do 5,2 g/l</span>
            <span><span style={{ color: 'var(--warn)' }}>●</span> povolené, hustota 5,2–6,2 g/l</span>
            <span><span style={{ color: 'var(--border)' }}>●</span> mimo limity</span>
          </p>
          <Button variant="ghost" className="!px-0" onClick={() => setDetail(!detail)}>{detail ? 'Zobrazit celý trojúhelník' : 'Zobrazit detail do 40 % O2'}</Button>
        </div>
      </div>
      <div className={`rounded-2xl border-2 p-4 ${check.allowed ? 'border-ok' : 'border-danger'}`} role="status" data-testid="ternary-verdict">
        <div className="text-lg font-semibold">{gasLabel(mix)} v {depth} m: {check.allowed ? 'v limitech' : 'mimo limity'}</div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">ppO2</dt><dd className="font-semibold tabular-nums">{formatCs(check.ppO2Bar, 2)} bar</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">END</dt><dd className="font-semibold tabular-nums">{formatCs(check.endM, 1)} m</dd></div>
          <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Hustota</dt><dd className="font-semibold tabular-nums">{formatCs(check.densityGL, 2)} g/l</dd></div>
        </dl>
        {problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-danger">{problems.map((problem) => <li key={String(problem)}>{problem}</li>)}</ul>}
      </div>
    </div>
  );
}
