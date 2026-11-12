import { absPressure, boyleVolume, DENSITY_HARD_LIMIT_GL, DENSITY_RECOMMENDED_GL, densityOfMix, formatCs, haldaneTissuePressure, ppO2 } from '@diveedu/calc';
import { mValueN2 } from '@diveedu/deco';
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

// ── Gradient factors ─────────────────────────────────────────────────────────
const GF_COMPARTMENT = 5;
const GF_LOW = 0.3;
const GF_HIGH = 0.85;
const FIRST_STOP_BAR = 2.5; // okolní tlak v 15 m

const GradientFaktory: Scene = ({ cue, p }) => {
  const px = (bar: number) => 44 + (bar - 1) * 62;
  const py = (bar: number) => 176 - bar * 21;
  const m = (ambient: number) => mValueN2(GF_COMPARTMENT, ambient);
  const allowed = (ambient: number, gf: number) => ambient + gf * (m(ambient) - ambient);
  const low: [number, number] = [FIRST_STOP_BAR, allowed(FIRST_STOP_BAR, GF_LOW)];
  const high: [number, number] = [1, allowed(1, GF_HIGH)];
  const travel = cue === 4 ? ease(span(p, 0.15, 0.9)) : cue > 4 ? 1 : 0;
  const dot: [number, number] = [lerp(low[0], high[0], travel), lerp(low[1], high[1], travel)];
  const band = cue >= 1 ? (cue === 1 ? span(p, 0, 0.3) : 1) : 0;
  return (
    <Frame label="Graf tlaku v tkáni proti okolnímu tlaku: okolní tlak, M-hodnota a čára gradient factors">
      <polygon points={`${px(1)},${py(1)} ${px(5)},${py(5)} ${px(5)},${py(m(5))} ${px(1)},${py(m(1))}`} fill="var(--warn)" opacity={band * 0.18} />
      <line x1={px(1)} y1={py(1)} x2={px(5)} y2={py(5)} stroke="var(--text)" strokeWidth="1.5" />
      <text x={px(5) - 2} y={py(5) + 14} textAnchor="end" fontSize="8.5" fill="var(--text)">okolní tlak</text>
      <line x1={px(1)} y1={py(m(1))} x2={px(5)} y2={py(m(5))} stroke="var(--danger)" strokeWidth="2" />
      <text x={px(5) - 2} y={py(m(5)) - 5} textAnchor="end" fontSize="8.5" fill="var(--danger)">M-hodnota</text>
      {band > 0 && <text x={px(2.9)} y={py((2.9 + m(2.9)) / 2) + 3} textAnchor="middle" fontSize="8.5" fill="var(--warn)" opacity={band}>pásmo přesycení</text>}
      {cue >= 2 && <g opacity={cue === 2 ? span(p, 0.1, 0.3) : 1}><circle cx={px(low[0])} cy={py(low[1])} r="4.5" fill="var(--accent)" /><text x={px(low[0]) + 4} y={py(low[0]) + 18} fontSize="8.5" fill="var(--accent)">30 % · první zastávka</text></g>}
      {cue >= 3 && <g opacity={cue === 3 ? span(p, 0.1, 0.3) : 1}><circle cx={px(high[0])} cy={py(high[1])} r="4.5" fill="var(--accent)" /><text x={px(high[0]) + 4} y={py(high[0]) + 18} fontSize="8.5" fill="var(--accent)">85 % · hladina</text></g>}
      {cue >= 4 && <line x1={px(low[0])} y1={py(low[1])} x2={px(high[0])} y2={py(high[1])} stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" opacity={cue === 4 ? span(p, 0, 0.15) : 1} />}
      {cue >= 4 && <circle cx={px(dot[0])} cy={py(dot[1])} r="6" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
      <line x1={px(1)} y1="182" x2={px(5)} y2="182" stroke="var(--muted)" />
      <text x={px(1)} y="194" fontSize="8" fill="var(--muted)">hladina</text>
      <text x={px(5)} y="194" textAnchor="end" fontSize="8" fill="var(--muted)">hloubka →</text>
      <text x="12" y="16" fontSize="8" fill="var(--muted)">tlak dusíku v tkáni ↑</text>
    </Frame>
  );
};

// ── Hustota a helium ─────────────────────────────────────────────────────────
const HustotaAHelium: Scene = ({ cue, p }) => {
  const morph = ease(span(p, 0.1, 0.7));
  const state: [number, number, number][] = [
    [0.21, 0, 0],
    [0.21, 0, lerp(0, 40, ease(span(p, 0.1, 0.7)))],
    [0.21, 0, 40],
    [0.21, 0, 40],
    [lerp(0.21, 0.18, morph), lerp(0, 0.45, morph), lerp(40, 60, morph)],
    [0.18, 0.45, 60],
  ];
  const [fO2, fHe, depth] = state[cue] ?? [0.21, 0, 0];
  const density = densityOfMix(fO2, fHe, depth);
  const air = densityOfMix(0.21, 0, 60) * (cue === 5 ? ease(span(p, 0, 0.4)) : 0);
  const base = 178;
  const scale = 15;
  const tone = (value: number) => (value > DENSITY_HARD_LIMIT_GL ? 'var(--danger)' : value > DENSITY_RECOMMENDED_GL ? 'var(--warn)' : 'var(--ok)');
  const limits = cue >= 3;
  return (
    <Frame label={`Hustota dýchané směsi v ${formatCs(depth, 0)} m: ${formatCs(density, 1)} g/l`}>
      <rect x="26" y={base - density * scale} width="36" height={density * scale} fill={tone(density)} fillOpacity="0.75" />
      <text x="44" y={base + 12} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{fHe > 0.01 ? 'trimix' : 'vzduch'}</text>
      {cue === 5 && <><rect x="68" y={base - air * scale} width="36" height={air * scale} fill={tone(air)} fillOpacity="0.75" /><text x="86" y={base + 12} textAnchor="middle" fontSize="8.5" fill="var(--muted)">vzduch</text></>}
      <line x1="20" y1={base} x2="110" y2={base} stroke="var(--muted)" />
      {limits && [[DENSITY_RECOMMENDED_GL, 'doporučená mez', 10], [DENSITY_HARD_LIMIT_GL, 'horní mez', -4]].map(([limit, text, dy]) => (
        <g key={text} opacity={cue === 3 ? span(p, 0, 0.2) : 1}>
          <line x1="20" y1={base - Number(limit) * scale} x2="196" y2={base - Number(limit) * scale} stroke="var(--danger)" strokeDasharray="4 3" />
          <text x="112" y={base - Number(limit) * scale + Number(dy)} fontSize="7.5" fill="var(--danger)">{formatCs(Number(limit), 1)} · {text}</text>
        </g>
      ))}
      {cue === 2 && <text x="44" y={base - density * scale - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--warn)" opacity={span(p, 0.1, 0.3)}>CO₂ ↑</text>}
      <Readout x={208} y={40} label="Směs" value={fHe > 0.01 ? `Tx ${formatCs(fO2 * 100, 0)}/${formatCs(fHe * 100, 0)}` : 'vzduch'} />
      <Readout x={208} y={86} label="Hloubka" value={`${formatCs(depth, 0)} m`} />
      <Readout x={208} y={132} label="Hustota" value={`${formatCs(density, 1)} g/l`} tone={tone(density)} />
      {cue === 5 && <text x="208" y="186" fontSize="9" fill="var(--danger)" opacity={span(p, 0.4, 0.6)}>vzduch v 60 m: {formatCs(densityOfMix(0.21, 0, 60), 1)} g/l</text>}
    </Frame>
  );
};

// ── Skok cívkou ──────────────────────────────────────────────────────────────
const SkokCivkou: Scene = ({ cue, p }) => {
  const JUMP: [number, number] = [176, 142];
  const SIDE: [number, number] = [196, 88];
  const FAR: [number, number] = [286, 44];
  const along = (from: [number, number], to: [number, number], q: number): [number, number] => [lerp(from[0], to[0], q), lerp(from[1], to[1], q)];
  const back = ease(span(p, 0, 0.45));
  const diver: [number, number] = [
    [lerp(40, 150, ease(p)), 142],
    [lerp(150, 168, ease(p)), 142],
    [168, 142],
    along(JUMP, SIDE, ease(span(p, 0.2, 0.9))),
    along(SIDE, [250, 62], ease(p)),
    back < 1 ? along([250, 62], JUMP, back) : [lerp(JUMP[0], 110, ease(span(p, 0.75, 1))), 142],
  ][cue] as [number, number] ?? [40, 142];
  const spool = cue === 3 ? ease(span(p, 0.2, 0.9)) : cue === 4 ? 1 : cue === 5 ? 1 - ease(span(p, 0.5, 0.75)) : 0;
  const end = along(JUMP, SIDE, spool);
  const cookie = cue > 2 || (cue === 2 && p > 0.3);
  const continuous = cue === 4;
  return (
    <Frame label="Hlavní a boční šňůra oddělené mezerou; skok cívkou je spojí">
      <line x1="16" y1="142" x2="304" y2="142" stroke="var(--warn)" strokeWidth={continuous ? 4 : 3} />
      <line x1={SIDE[0]} y1={SIDE[1]} x2={FAR[0]} y2={FAR[1]} stroke="var(--text)" strokeWidth={continuous ? 3 : 2} />
      <polygon points="8,0 -6,-6 -2,0 -6,6" fill="var(--warn)" transform="translate(90 142) rotate(180)" />
      <text x="18" y="160" fontSize="8.5" fill="var(--muted)">← východ · hlavní šňůra</text>
      <text x="230" y="86" fontSize="8.5" fill="var(--muted)">boční šňůra</text>
      {spool < 1 && <line x1={end[0]} y1={end[1]} x2={SIDE[0]} y2={SIDE[1]} stroke={cue === 1 ? 'var(--danger)' : 'var(--muted)'} strokeWidth="2" strokeDasharray="2 6" opacity={cue === 1 ? 0.5 + 0.5 * Math.abs(Math.sin(p * Math.PI * 4)) : 0.7} />}
      {cue === 1 && <text x="120" y="112" fontSize="9" fontWeight="700" fill="var(--danger)">mezera</text>}
      {spool > 0 && <line x1={JUMP[0]} y1={JUMP[1]} x2={end[0]} y2={end[1]} stroke="var(--accent)" strokeWidth="2.5" />}
      {cookie && <circle cx="160" cy="142" r="6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />}
      {cue === 5 && <circle cx={Math.max(60, diver[0] - 34)} cy={diver[1] === 142 ? 142 : lerp(142, diver[1], 0.4)} r="6" fill="var(--ok)" stroke="var(--bg)" strokeWidth="1.5" opacity={back >= 1 ? 1 : span(p, 0.3, 0.45)} />}
      <circle cx={diver[0]} cy={diver[1]} r="6" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />
      {continuous && <text x="160" y="186" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ok)" opacity={span(p, 0, 0.2)}>souvislá šňůra až do otevřené vody</text>}
      {cue === 5 && <text x="160" y="186" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)" opacity={span(p, 0.5, 0.65)}>cívku sbírá poslední</text>}
    </Frame>
  );
};

export const SCENES: Readonly<Record<string, Scene>> = {
  'tlak-a-objem': TlakAObjem,
  'ppo2-a-mod': Ppo2AMod,
  'syceni-a-dekomprese': SyceniADekomprese,
  'tretiny-v-jeskyni': TretinyVJeskyni,
  'rozcesti-a-znacky': RozcestiAZnacky,
  'gradient-faktory': GradientFaktory,
  'hustota-a-helium': HustotaAHelium,
  'skok-civkou': SkokCivkou,
};
