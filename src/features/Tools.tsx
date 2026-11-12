import { densityRating, floorTo, formatCs, gasDensity, mod, modSteps, ppO2, ppO2Steps } from '@diveedu/calc';
import { useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Steps } from '../components/Steps';
import { Badge, Card, PageHeader, SliderField } from '../components/ui';

const PPO2_LIMITS = [1.2, 1.4, 1.6];

/** První kalkulačka (režim „Spočti mi“). Další kalkulačky a režimy přibudou s moduly. */
export function Tools() {
  const [o2Percent, setO2Percent] = useState(32);
  const [depth, setDepth] = useState(30);
  const [limit, setLimit] = useState(1.4);
  const fO2 = o2Percent / 100;
  const partial = ppO2(fO2, depth);
  const maxDepth = mod(fO2, limit);
  const density = gasDensity({ fO2, fHe: 0 }, depth);
  const rating = densityRating(density);
  const over = partial > limit + 1e-9;

  return (
    <div>
      <PageHeader title="Nástroje" subtitle="Kalkulačky s rozepsaným postupem. Všechny výpočty běží v jednom ověřeném balíčku." />
      <div className="mb-5"><Disclaimer kind="calc" /></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">ppO2 a MOD nitroxu</h2>
          <div className="mt-4 space-y-4">
            <SliderField label="Kyslík ve směsi" value={o2Percent} min={21} max={100} step={1} unit="%" onChange={setO2Percent} />
            <SliderField label="Hloubka" value={depth} min={0} max={70} step={1} unit="m" onChange={setDepth} />
            <fieldset>
              <legend className="text-sm font-medium text-muted">Limit ppO2</legend>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {PPO2_LIMITS.map((value) => (
                  <button key={value} type="button" aria-pressed={value === limit} onClick={() => setLimit(value)} className={`min-h-12 rounded-xl border-2 font-semibold tabular-nums ${value === limit ? 'border-accent bg-accent/15' : 'border-border'}`}>
                    {formatCs(value, 1)} bar
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className={`rounded-xl p-3 ${over ? 'bg-danger/15' : 'bg-surface-2'}`}>
              <dt className="text-xs text-muted">ppO2 v hloubce</dt>
              <dd className="text-2xl font-bold tabular-nums" data-testid="tool-ppo2">{formatCs(partial, 2)} bar</dd>
              {over && <dd className="text-sm font-semibold text-danger">nad limitem</dd>}
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">MOD (zaokrouhleno dolů)</dt>
              <dd className="text-2xl font-bold tabular-nums" data-testid="tool-mod">{formatCs(floorTo(maxDepth), 0)} m</dd>
              <dd className="text-xs text-muted">přesně {formatCs(maxDepth, 2)} m</dd>
            </div>
          </dl>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            Hustota plynu v hloubce: <strong className="tabular-nums text-text">{formatCs(density, 2)} g/l</strong>
            <Badge tone={rating === 'ok' ? 'ok' : 'warn'}>{rating === 'ok' ? 'do 5,2 g/l' : rating === 'warning' ? 'nad doporučeným limitem 5,2 g/l' : 'nad tvrdým limitem 6,2 g/l'}</Badge>
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Postup</h2>
          <h3 className="mb-2 mt-3 text-sm font-semibold text-muted">Parciální tlak kyslíku</h3>
          <Steps steps={ppO2Steps(fO2, depth)} />
          <h3 className="mb-2 mt-5 text-sm font-semibold text-muted">Maximální operační hloubka</h3>
          <Steps steps={modSteps(fO2, limit)} />
        </Card>
      </div>
    </div>
  );
}
