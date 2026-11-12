import { densityOfMix, endOfMix, formatCs, ppN2, ppO2 } from '@diveedu/calc';
import { useState } from 'react';
import { Link } from 'react-router';
import { SliderField } from '../components/ui';

type Level = 0 | 1 | 2;
const TONE: Record<Level, { box: string; label: string }> = {
  0: { box: 'border-ok/70 bg-ok/10', label: 'v normě' },
  1: { box: 'border-warn bg-warn/15', label: 'zvýšené' },
  2: { box: 'border-danger bg-danger/20', label: 'nebezpečné' },
};
const clamp = (level: number): Level => Math.max(0, Math.min(2, level)) as Level;

/**
 * Pohled „Co kdyby“: změň hloubku, směs nebo námahu a sleduj, které uzly řetězu se zhorší.
 * Hodnoty počítá calc; stupně (v normě / zvýšené / nebezpečné) jsou výukové prahy:
 * ppO2 1,4 a 1,6 bar, END 30 a 40 m, hustota 5,2 a 6,2 g/l.
 */
export function WhatIfGraph() {
  const [depth, setDepth] = useState(45);
  const [o2, setO2] = useState(21);
  const [he, setHe] = useState(0);
  const [effort, setEffort] = useState(false);

  const fO2 = o2 / 100;
  const fHe = Math.min(he, 100 - o2) / 100;
  const pO2 = ppO2(fO2, depth);
  const pN2 = ppN2({ fO2, fHe }, depth);
  const end = endOfMix(fO2, fHe, depth);
  const density = densityOfMix(fO2, fHe, depth);

  const lvO2: Level = pO2 > 1.6 || pO2 < 0.18 ? 2 : pO2 > 1.4 ? 1 : 0;
  const lvN2: Level = end > 40 ? 2 : end > 30 ? 1 : 0;
  const lvDensity: Level = density > 6.2 ? 2 : density > 5.2 ? 1 : 0;
  const lvWork = lvDensity;
  const lvCo2 = clamp(lvWork + (effort ? 1 : 0));
  // CO2 je sám narkotický a narkózu dusíkem zesiluje: vysoký CO2 posune stupeň o jedna.
  const lvNarcosis = clamp(lvN2 + (lvCo2 === 2 ? 1 : 0));
  const lvCns = clamp(pO2 < 0.18 ? 0 : lvO2 + (lvCo2 === 2 && lvO2 > 0 ? 1 : 0));
  const lvHypoxia: Level = pO2 < 0.16 ? 2 : pO2 < 0.18 ? 1 : 0;

  const node = (id: string, title: string, value: string, level: Level) => (
    <Link to={`/graf/${id}`} className={`block rounded-xl border-2 px-3 py-2 transition-colors duration-500 ${TONE[level].box}`} data-node-level={level} data-whatif={id}>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs tabular-nums text-muted">{value}{value ? ' · ' : ''}{TONE[level].label}</span>
    </Link>
  );
  const column = 'space-y-2';
  const head = 'mb-1 text-xs font-semibold uppercase tracking-wide text-muted';

  return (
    <div className="space-y-5" data-testid="whatif-graph">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField label="Hloubka" value={depth} min={0} max={100} step={5} unit="m" onChange={setDepth} />
        <SliderField label="Kyslík ve směsi" value={o2} min={8} max={100} step={1} unit="%" onChange={(value) => { setO2(value); setHe(Math.min(he, 100 - value)); }} />
        <SliderField label="Helium ve směsi" value={Math.min(he, 100 - o2)} min={0} max={100 - o2} step={5} unit="%" onChange={setHe} />
        <label className="flex min-h-12 items-center gap-3 self-end">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={effort} onChange={(event) => setEffort(event.target.checked)} />
          Těžká práce (plavání proti proudu)
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={column}>
          <div className={head}>Fyzika</div>
          {node('ppo2', 'ppO2', `${formatCs(pO2, 2)} bar`, lvO2)}
          {node('ppn2', 'ppN2 a END', `${formatCs(pN2, 2)} bar, END ${formatCs(end, 0)} m`, lvN2)}
          {node('hustota-plynu', 'Hustota plynu', `${formatCs(density, 2)} g/l`, lvDensity)}
        </div>
        <div className={column}>
          <div className={head}>Fyziologie</div>
          {node('prace-dychani', 'Práce dýchání', '', lvWork)}
          {node('retence-co2', 'Retence CO2', effort ? 'námaha zvyšuje tvorbu CO2' : '', lvCo2)}
        </div>
        <div className={column}>
          <div className={head}>Riziko</div>
          {node('dusikova-narkoza', 'Narkóza', lvCo2 > 0 && lvNarcosis > lvN2 ? 'zesílená CO2' : '', lvNarcosis)}
          {node('cns-toxicita', 'CNS toxicita', lvCns > lvO2 ? 'práh snížený CO2' : '', lvCns)}
          {node('hypoxie', 'Hypoxie', '', lvHypoxia)}
        </div>
      </div>
      <p className="text-sm text-muted">
        Hloubka působí přímo přes ppO2 a ppN2 a nepřímo přes hustotu: hustší plyn → větší práce dýchání → CO2 → silnější narkóza a nižší práh kyslíkových křečí.
        Helium přerušuje spodní cestu i narkózu. Stupně jsou výukové prahy, ne měření tvého těla.
      </p>
    </div>
  );
}
