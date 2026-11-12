import { absPressure, boyleVolume, formatCs, pressureRatio } from '@diveedu/calc';
import { type ComponentType, useState } from 'react';
import { SliderField } from '../components/ui';
import { TissueSimulator } from './TissueSimulator';

/** Hračka k lekci Tlak a hloubka: posuvník hloubky, tlak a objem balonku. */
function DepthPressure() {
  const [depth, setDepth] = useState(10);
  const pressure = absPressure(depth);
  const volume = boyleVolume(10, 0, depth);
  const stepRatio = pressureRatio(depth, depth + 10);
  // Poloměr koule roste s třetí odmocninou objemu.
  const radius = 54 * Math.cbrt(volume / 10);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
      <div className="space-y-4">
        <SliderField label="Hloubka" value={depth} min={0} max={60} step={1} unit="m" onChange={setDepth} />
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">Absolutní tlak</dt>
            <dd className="text-2xl font-bold tabular-nums" data-testid="toy-pressure">{formatCs(pressure, 1)} bar</dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">Balonek 10 l z hladiny</dt>
            <dd className="text-2xl font-bold tabular-nums">{formatCs(volume, 1)} l</dd>
          </div>
        </dl>
        <p className="text-sm text-muted">
          Dalších 10 m hlouběji vzroste tlak {formatCs(stepRatio, 2)}×. U hladiny je to dvojnásobek, v hloubce už jen zlomek.
        </p>
      </div>
      <svg viewBox="0 0 200 220" role="img" aria-label={`Balonek v hloubce ${depth} m má objem ${formatCs(volume, 1)} litru`} className="mx-auto w-full max-w-64">
        <rect x="0" y="0" width="200" height="220" rx="16" fill="var(--surface-2)" />
        <line x1="0" y1="28" x2="200" y2="28" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 5" />
        <text x="10" y="20" fontSize="11" fill="var(--muted)">hladina</text>
        <circle cx="100" cy="125" r="54" fill="none" stroke="var(--border)" strokeDasharray="3 4" />
        <circle cx="100" cy="125" r={radius} fill="var(--accent)" fillOpacity="0.3" stroke="var(--accent)" strokeWidth="2" style={{ transition: 'r 150ms ease-out' }} />
        <text x="100" y="208" fontSize="11" textAnchor="middle" fill="var(--muted)">čárkovaně: objem na hladině</text>
      </svg>
    </div>
  );
}

export const PLAYGROUNDS: Record<string, ComponentType> = {
  'depth-pressure': DepthPressure,
};

/**
 * Orientační hloubky, ve kterých v čisté vodě mizí barvy denního světla.
 * Ilustrativní hodnoty – závisí na čistotě vody, slunci a směru pohledu.
 */
const COLORS = [
  { name: 'červená', until: 5, css: '#d64545' },
  { name: 'oranžová', until: 10, css: '#e0862f' },
  { name: 'žlutá', until: 20, css: '#d9c13a' },
  { name: 'zelená', until: 30, css: '#3fae6a' },
  { name: 'modrá', until: 60, css: '#3d7bd9' },
];

function LightAbsorption() {
  const [depth, setDepth] = useState(12);
  const [torch, setTorch] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
      <div className="space-y-4">
        <SliderField label="Hloubka" value={depth} min={0} max={60} step={1} unit="m" onChange={setDepth} />
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={torch} onChange={(event) => setTorch(event.target.checked)} />
          Rozsvítit svítilnu (světlo urazí jen krátkou dráhu)
        </label>
        <p className="text-sm text-muted">Hodnoty jsou orientační pro čistou vodu. Voda pohlcuje nejdřív dlouhé vlnové délky, proto červená mizí první.</p>
      </div>
      <ul className="grid grid-cols-5 gap-2" aria-label="Barvy viditelné v této hloubce">
        {COLORS.map((color) => {
          const visible = torch || depth < color.until;
          return (
            <li key={color.name} className="text-center text-xs">
              <span className="mx-auto block h-16 rounded-xl border border-border" style={{ background: visible ? color.css : '#5f7480', transition: 'background 200ms' }} />
              <span className={visible ? '' : 'text-muted line-through'}>{color.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Kyslíkové okno: ilustrativní parciální tlaky v arteriální a venózní krvi (mmHg).
 * Zjednodušené učebnicové hodnoty podle Behnkeho konceptu; slouží k pochopení principu, ne k výpočtu.
 */
const WINDOW_CASES = {
  air: { label: 'Vzduch na hladině', arterial: { O2: 95, CO2: 40, N2: 573, H2O: 47 }, venous: { O2: 44, CO2: 45, N2: 573, H2O: 47 } },
  oxygen: { label: 'Kyslík v 6 m', arterial: { O2: 1100, CO2: 40, N2: 0, H2O: 47 }, venous: { O2: 60, CO2: 45, N2: 0, H2O: 47 } },
} as const;
const GAS_CSS = { O2: 'var(--accent)', CO2: 'var(--warn)', N2: 'var(--muted)', H2O: 'var(--border)' } as const;

function OxygenWindow() {
  const [key, setKey] = useState<keyof typeof WINDOW_CASES>('air');
  const data = WINDOW_CASES[key];
  const sum = (side: Record<string, number>) => Object.values(side).reduce((a, b) => a + b, 0);
  const ambient = sum(data.arterial);
  const window = ambient - sum(data.venous);
  const bar = (title: string, side: Record<keyof typeof GAS_CSS, number>) => (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{title}</span><span className="tabular-nums text-muted">{sum(side)} mmHg</span></div>
      <div className="flex h-9 overflow-hidden rounded-lg border border-border" style={{ width: '100%' }}>
        {(Object.keys(GAS_CSS) as (keyof typeof GAS_CSS)[]).map((gas) => (
          <span key={gas} title={`${gas} ${side[gas]} mmHg`} style={{ width: `${(side[gas] / ambient) * 100}%`, background: GAS_CSS[gas], transition: 'width 200ms' }} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-2 gap-2">
        {(Object.keys(WINDOW_CASES) as (keyof typeof WINDOW_CASES)[]).map((option) => (
          <button key={option} type="button" aria-pressed={option === key} onClick={() => setKey(option)} className={`min-h-12 rounded-xl border-2 font-semibold ${option === key ? 'border-accent bg-accent/15' : 'border-border text-muted'}`}>{WINDOW_CASES[option].label}</button>
        ))}
      </div>
      {bar('Arteriální krev (přibližně okolní tlak)', data.arterial)}
      {bar('Venózní krev', data.venous)}
      <p className="rounded-xl bg-surface-2 p-3">
        Nevyplněná část venózního sloupce je <strong>kyslíkové okno: přibližně {window} mmHg</strong>.
        Tkáně kyslík spotřebují a CO2, který vrátí, zvedne parciální tlak jen málo. Vzniklý „prostor“ pomáhá inertnímu plynu na cestě ven.
      </p>
      <p className="flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(GAS_CSS) as (keyof typeof GAS_CSS)[]).map((gas) => <span key={gas} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: GAS_CSS[gas] }} />{gas}</span>)}
        <span>Hodnoty jsou ilustrativní.</span>
      </p>
    </div>
  );
}

Object.assign(PLAYGROUNDS, { 'light-absorption': LightAbsorption, 'oxygen-window': OxygenWindow, 'tissue-sim': TissueSimulator });
