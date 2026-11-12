import { absPressure, boyleVolume, formatCs, pressureRatio } from '@diveedu/calc';
import { type ComponentType, useState } from 'react';
import { SliderField } from '../components/ui';

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
