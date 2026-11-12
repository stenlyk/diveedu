import { absPressure, boyleVolume, formatCs, haldaneTissuePressure, ppO2 } from '@diveedu/calc';
import type { ComponentType, ReactNode } from 'react';
import { ease, lerp, type Position, span } from './timing';

/** Scéna dostává číslo věty a postup v ní; sama si nic nepamatuje, takže jde přetáčet. */
type Scene = ComponentType<Position>;

const W = 320;
const H = 200;
const Frame = ({ children, label }: { children: ReactNode; label: string }) => (
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full rounded-2xl bg-surface-2">{children}</svg>
);
const Readout = ({ x, y, label, value, tone = 'var(--text)' }: { x: number; y: number; label: string; value: string; tone?: string }) => (
  <g>
    <text x={x} y={y} fontSize="9" fill="var(--muted)">{label}</text>
    <text x={x} y={y + 16} fontSize="15" fontWeight="700" fill={tone} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</text>
  </g>
);

// ── Tlak a objem ─────────────────────────────────────────────────────────────
const TlakAObjem: Scene = ({ cue, p }) => {
  const depth = [0, lerp(0, 10, ease(span(p, 0, 0.6))), lerp(10, 30, ease(span(p, 0, 0.6))), 30, lerp(10, 0, ease(span(p, 0.3, 0.9))), 0][cue] ?? 0;
  const lungs = cue >= 4;
  // Od páté věty jde o plyn nadechnutý v 10 m, který se při výstupu rozpíná.
  const volume = lungs ? boyleVolume(10, 10, depth) : boyleVolume(10, 0, depth);
  const radius = 20 * Math.cbrt(volume / 10);
  // Balonek zůstává celý pod hladinou.
  const y = Math.max(34 + depth * 4.8, 36 + radius);
  return (
    <Frame label={`Balonek v hloubce ${formatCs(depth, 0)} m má objem ${formatCs(volume, 1)} l`}>
      <rect x="16" y="34" width="150" height="156" fill="var(--accent)" fillOpacity="0.12" />
      <line x1="16" y1="34" x2="166" y2="34" stroke="var(--accent)" strokeWidth="2" />
      {[0, 10, 20, 30].map((mark) => <text key={mark} x="20" y={38 + mark * 4.8 + (mark === 0 ? 8 : 3)} fontSize="8" fill="var(--muted)">{mark} m</text>)}
      {cue === 3 && (
        <g fontSize="8.5" fill="var(--warn)" stroke="var(--warn)">
          <line x1="150" y1="34" x2="150" y2="82" strokeWidth="2" opacity={span(p, 0.2, 0.35)} />
          <text x="146" y="62" textAnchor="end" stroke="none" opacity={span(p, 0.2, 0.35)}>−50 %</text>
          <line x1="150" y1="84" x2="150" y2="178" strokeWidth="2" opacity={span(p, 0.5, 0.65)} />
          <text x="146" y="134" textAnchor="end" stroke="none" opacity={span(p, 0.5, 0.65)}>−25 %</text>
        </g>
      )}
      <circle cx="92" cy={y} r={radius} fill={lungs ? 'var(--warn)' : 'var(--accent)'} fillOpacity="0.35" stroke={lungs ? 'var(--warn)' : 'var(--accent)'} strokeWidth="2" />
      {lungs && <text x="92" y={y + 3} textAnchor="middle" fontSize="8" fill="var(--text)">plíce</text>}
      <Readout x={186} y={48} label="Hloubka" value={`${formatCs(depth, 0)} m`} />
      <Readout x={186} y={92} label="Absolutní tlak" value={`${formatCs(absPressure(depth), 1)} bar`} />
      <Readout x={186} y={136} label={lungs ? 'Objem plynu z 10 m' : 'Objem balonku'} value={`${formatCs(volume, 1)} l`} tone={lungs && volume > 15 ? 'var(--danger)' : 'var(--text)'} />
      {cue === 5 && <text x="186" y="184" fontSize="10" fontWeight="700" fill="var(--danger)" opacity={span(p, 0, 0.2)}>Nikdy nezadržuj dech</text>}
    </Frame>
  );
};

// ── ppO2 a MOD ───────────────────────────────────────────────────────────────
const Ppo2AMod: Scene = ({ cue, p }) => {
  const late = span(p, 0.5, 0.75);
  const state: [number, number][] = [
    [0.21, 0],
    [0.21, lerp(0, 40, ease(span(p, 0.1, 0.7)))],
    [lerp(0.21, 0.32, ease(span(p, 0, 0.5))), 40],
    [0.32, 40],
    [0.32, lerp(40, 33, ease(span(p, 0.3, 0.8)))],
    [lerp(0.5, 1, late), lerp(22, 6, late)],
  ];
  const [fO2, depth] = state[cue] ?? [0.21, 0];
  const total = absPressure(depth);
  const oxygen = ppO2(fO2, depth);
  const base = 178;
  const scale = 28;
  const limits = cue >= 3;
  const tone = oxygen > 1.605 ? 'var(--danger)' : oxygen > 1.405 ? 'var(--warn)' : 'var(--ok)';
  return (
    <Frame label={`Směs s ${formatCs(fO2 * 100, 0)} % kyslíku v ${formatCs(depth, 0)} m: parciální tlak kyslíku ${formatCs(oxygen, 2)} bar`}>
      <text x="60" y="20" textAnchor="middle" fontSize="9" fill="var(--muted)">celkový tlak</text>
      <rect x="34" y={base - total * scale} width="52" height={total * scale} fill="var(--border)" />
      <rect x="34" y={base - oxygen * scale} width="52" height={oxygen * scale} fill={tone} fillOpacity="0.75" />
      <text x="60" y={base - (oxygen * scale) / 2 + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--bg)">O₂</text>
      <line x1="30" y1={base} x2="150" y2={base} stroke="var(--muted)" />
      {limits && [[1.4, 'při práci'], [1.6, 'v klidu']].map(([limit, text]) => (
        <g key={limit} opacity={cue === 3 ? span(p, 0, 0.2) : 1}>
          <line x1="28" y1={base - Number(limit) * scale} x2="150" y2={base - Number(limit) * scale} stroke="var(--danger)" strokeDasharray="4 3" />
          <text x="94" y={base - Number(limit) * scale + (limit === 1.4 ? 10 : -4)} fontSize="8" fill="var(--danger)">{formatCs(Number(limit), 1)} bar {text}</text>
        </g>
      ))}
      <Readout x={176} y={36} label="Kyslík ve směsi" value={`${formatCs(fO2 * 100, 0)} %`} />
      <Readout x={176} y={76} label="Hloubka" value={`${formatCs(depth, 0)} m`} />
      <Readout x={176} y={116} label="Celkový tlak" value={`${formatCs(total, 1)} bar`} />
      <Readout x={176} y={156} label="Parciální tlak kyslíku" value={`${formatCs(oxygen, 2)} bar`} tone={tone} />
    </Frame>
  );
};

// ── Sycení tkání a dekomprese ────────────────────────────────────────────────
const HALF_TIMES = [5, 12.5, 27, 77, 239];
const SURFACE_N2 = 0.79;
const BOTTOM_N2 = SURFACE_N2 * absPressure(30); // vzduch ve 30 m
const STOP_N2 = SURFACE_N2 * absPressure(6); // vzduch v 6 m
const BOTTOM_MINUTES = 25;
const STOP_MINUTES = 25;

const SyceniADekomprese: Scene = ({ cue, p }) => {
  const bottomTime = cue === 1 ? 5 * p : cue === 2 ? 5 + (BOTTOM_MINUTES - 5) * p : cue >= 3 ? BOTTOM_MINUTES : 0;
  const stopTime = cue === 5 ? STOP_MINUTES * p : 0;
  const ambient = cue === 0 ? SURFACE_N2 : cue === 1 ? lerp(SURFACE_N2, BOTTOM_N2, ease(span(p, 0, 0.25))) : cue === 2 ? BOTTOM_N2 : cue === 3 ? lerp(BOTTOM_N2, STOP_N2, ease(span(p, 0, 0.4))) : STOP_N2;
  const tissues = HALF_TIMES.map((half) => {
    const loaded = bottomTime > 0 ? haldaneTissuePressure(SURFACE_N2, BOTTOM_N2, half, bottomTime) : SURFACE_N2;
    return stopTime > 0 ? haldaneTissuePressure(loaded, STOP_N2, half, stopTime) : loaded;
  });
  const base = 170;
  const scale = 40;
  const minutes = cue === 5 ? `zastávka ${formatCs(stopTime, 0)} min` : cue >= 1 ? `na dně ${formatCs(bottomTime, 0)} min` : 'na hladině';
  return (
    <Frame label={`Tlak dusíku v pěti tkáních, ${minutes}`}>
      <text x="16" y="18" fontSize="9" fill="var(--muted)">tlak dusíku v tkáních · {minutes}</text>
      {tissues.map((pressure, i) => {
        const x = 28 + i * 56;
        const over = Math.max(0, pressure - ambient);
        return (
          <g key={HALF_TIMES[i]}>
            <rect x={x} y={base - 3.3 * scale} width="34" height={3.3 * scale} fill="none" stroke="var(--border)" />
            <rect x={x} y={base - pressure * scale} width="34" height={pressure * scale} fill="var(--accent)" fillOpacity="0.55" />
            {cue >= 3 && over > 0.01 && <rect x={x} y={base - pressure * scale} width="34" height={over * scale} fill={cue === 4 ? 'var(--danger)' : 'var(--warn)'} fillOpacity="0.8" />}
            <text x={x + 17} y={base + 12} textAnchor="middle" fontSize="8" fill="var(--muted)">{formatCs(HALF_TIMES[i]!, Number.isInteger(HALF_TIMES[i]) ? 0 : 1)} min</text>
          </g>
        );
      })}
      <line x1="16" y1={base - ambient * scale} x2="304" y2={base - ambient * scale} stroke="var(--text)" strokeDasharray="5 4" />
      <text x="304" y={base - ambient * scale - 4} textAnchor="end" fontSize="8.5" fill="var(--text)">dusík, který dýcháš</text>
      <text x="16" y={base + 24} fontSize="8" fill="var(--muted)">rychlé tkáně</text>
      <text x="304" y={base + 24} textAnchor="end" fontSize="8" fill="var(--muted)">pomalé tkáně</text>
      {cue >= 3 && <text x="160" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill={cue === 4 ? 'var(--danger)' : 'var(--warn)'}>přesycení</text>}
    </Frame>
  );
};

// ── Pravidlo třetin ──────────────────────────────────────────────────────────
const TretinyVJeskyni: Scene = ({ cue, p }) => {
  const START = 30;
  const TURN = 250;
  const x = [lerp(START, 60, ease(p)), lerp(60, 170, p), lerp(170, TURN, ease(span(p, 0, 0.7))), TURN, lerp(TURN, 150, ease(p)), lerp(150, START, ease(span(p, 0, 0.85))), START][cue] ?? START;
  const out = cue >= 4;
  const inward = 210 - (70 * (x - START)) / (TURN - START);
  const donor = out ? (140 * (x - START)) / (TURN - START) : inward;
  const buddy = cue < 3 ? inward : cue === 3 ? lerp(140, 0, ease(span(p, 0.1, 0.5))) : 0;
  const Gauge = ({ y, name, bar }: { y: number; name: string; bar: number }) => (
    <g>
      <text x="16" y={y + 8} fontSize="8.5" fill="var(--muted)">{name}</text>
      <rect x="70" y={y} width="168" height="9" rx="3" fill="var(--border)" />
      <rect x="70" y={y} width={(168 * bar) / 210} height="9" rx="3" fill={bar < 1 ? 'var(--danger)' : bar < 141 ? 'var(--warn)' : 'var(--accent)'} />
      {[70, 140].map((third) => <line key={third} x1={70 + (168 * third) / 210} y1={y - 2} x2={70 + (168 * third) / 210} y2={y + 11} stroke="var(--text)" />)}
      <text x="246" y={y + 8} fontSize="10" fontWeight="700" fill={bar < 1 ? 'var(--danger)' : 'var(--text)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCs(bar, 0)} bar</text>
    </g>
  );
  return (
    <Frame label={`Dva potápěči v jeskyni, zásoby ${formatCs(donor, 0)} a ${formatCs(buddy, 0)} bar`}>
      <Gauge y={14} name="Ty" bar={donor} />
      <Gauge y={32} name="Partner" bar={buddy} />
      <rect x="0" y="62" width="320" height="138" fill="var(--border)" />
      <path d="M0 96 L40 100 Q160 84 300 104 L300 150 Q160 166 40 152 L0 158 Z" fill="var(--surface-2)" />
      <rect x="0" y="96" width="34" height="62" fill="var(--accent)" fillOpacity="0.18" />
      <text x="4" y="90" fontSize="8" fill="var(--muted)">vchod</text>
      <path d="M22 142 Q160 152 292 138" fill="none" stroke="var(--warn)" strokeWidth="1.5" />
      {cue >= 2 && <g opacity={cue === 2 ? span(p, 0.7, 0.85) : 1}><line x1={TURN + 8} y1="104" x2={TURN + 8} y2="146" stroke="var(--text)" strokeDasharray="3 3" /><text x={TURN + 12} y="116" fontSize="8" fill="var(--text)">otočka</text></g>}
      <circle cx={x} cy="126" r="6" fill="var(--accent)" />
      <circle cx={x + (out ? 13 : -13)} cy="130" r="6" fill={buddy < 1 && cue >= 3 ? 'var(--danger)' : 'var(--ok)'} />
      {out && <line x1={x} y1="126" x2={x + 13} y2="130" stroke="var(--text)" strokeWidth="1.5" />}
      {cue === 6 && <text x="160" y="186" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)" opacity={span(p, 0, 0.15)}>třetina dovnitř · třetina ven · třetina pro partnera</text>}
    </Frame>
  );
};

// ── Rozcestí a značky ────────────────────────────────────────────────────────
const RozcestiAZnacky: Scene = ({ cue, p }) => {
  const V1 = 28;
  const T = 160;
  const END = 286;
  const Y = 150;
  const x = [lerp(V1, 90, ease(p)), lerp(90, T - 8, ease(p)), T, lerp(T, 262, ease(span(p, 0, 0.5))), lerp(262, T, ease(p)), lerp(T, T - 14, ease(span(p, 0.5, 1))), lerp(T - 14, V1, ease(span(p, 0.1, 0.9)))][cue] ?? V1;
  const dark = cue === 3 ? span(p, 0.55, 0.9) : cue === 4 || cue === 5 ? 1 : cue === 6 ? 1 - span(p, 0.75, 1) : 0;
  const cookie = cue > 2 || (cue === 2 && p > 0.35);
  const pulse = cue === 5 ? 1 + 0.5 * Math.abs(Math.sin(p * Math.PI * 4)) : 1;
  const arrow = (ax: number, ay: number, angle: number, strong: boolean) => <polygon points="8,0 -6,-6 -2,0 -6,6" fill="var(--warn)" opacity={strong ? 1 : 0.9} transform={`translate(${ax} ${ay}) rotate(${angle}) scale(${strong ? 1.35 : 1})`} />;
  const emphasise = cue === 1;
  return (
    <Frame label="Mapa jeskyně se dvěma vchody, rozcestím, šipkami a vlastní značkou">
      <defs>
        <mask id="hmat">
          <rect width={W} height={H} fill="white" />
          <circle cx={x} cy={Y} r="38" fill="black" />
        </mask>
      </defs>
      <line x1={V1} y1={Y} x2={END} y2={Y} stroke="var(--warn)" strokeWidth="3" />
      <line x1={T} y1={Y} x2={T} y2="34" stroke="var(--warn)" strokeWidth="3" />
      {arrow(94, Y, 180, emphasise)}
      {arrow(T - 32, Y, 180, emphasise)}
      {arrow(T, 92, -90, emphasise)}
      {arrow(T, Y - 28, -90, emphasise)}
      {arrow(224, Y, 180, emphasise)}
      <circle cx={V1} cy={Y} r="7" fill="var(--ok)" stroke="var(--text)" strokeWidth="1.5" />
      <text x={V1 - 10} y={Y + 22} fontSize="9" fill="var(--text)">tvůj vchod</text>
      <circle cx={T} cy="34" r="7" fill="var(--muted)" stroke="var(--text)" strokeWidth="1.5" />
      <text x={T + 12} y="38" fontSize="9" fill="var(--muted)">jiný vchod</text>
      <text x={T + 8} y={Y + 18} fontSize="9" fill="var(--muted)">rozcestí</text>
      {cookie && <circle cx={T - 15} cy={Y} r={6 * pulse} fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />}
      {dark > 0 && <rect width={W} height={H} fill="black" opacity={dark * 0.94} mask="url(#hmat)" />}
      <circle cx={x} cy={Y} r="6" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />
      {dark > 0.5 && <text x="160" y="190" textAnchor="middle" fontSize="9" fill="#bbb">nulová viditelnost – jen to, co nahmatáš</text>}
    </Frame>
  );
};

export const SCENES: Readonly<Record<string, Scene>> = {
  'tlak-a-objem': TlakAObjem,
  'ppo2-a-mod': Ppo2AMod,
  'syceni-a-dekomprese': SyceniADekomprese,
  'tretiny-v-jeskyni': TretinyVJeskyni,
  'rozcesti-a-znacky': RozcestiAZnacky,
};
