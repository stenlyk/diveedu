import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

// Tlačítka podle návrhu: výška 48 px, rohy 4 px, žádné stíny; stav se ukazuje barvou plochy a okraje.
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[0.9375rem] font-semibold transition-colors disabled:opacity-45 disabled:pointer-events-none select-none';
const variants = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong active:bg-accent-strong',
  secondary: 'bg-surface-2 text-text border border-border hover:border-accent active:border-accent',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
  danger: 'border border-danger text-danger hover:bg-danger hover:text-accent-ink active:bg-danger active:text-accent-ink',
} as const;
type Variant = keyof typeof variants;

export function Button({ variant = 'primary', className = '', ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

/** Malý popisek nad údajem nebo sekcí (velká písmena, prostrkaný). */
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`label-ui ${className}`}>{children}</div>;
}

/** Odečet čísla s jednotkou: číslo neproporcionálním písmem, jednotka tlumeně a neoddělitelně. */
export function Reading({ value, unit, className = '', tone }: { value: ReactNode; unit?: string; className?: string; tone?: 'ok' | 'warn' | 'danger' | 'accent' }) {
  const color = tone ? { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger', accent: 'text-accent' }[tone] : 'text-text';
  return <span className={`font-mono tabular-nums ${color} ${className}`}>{value}{unit && <span className="text-[0.7em] font-normal text-muted">{'\u2009'}{unit}</span>}</span>;
}

/** Krokový ukazatel: segmenty hotové, aktuální a budoucí (návrh: 9 částí lekce). */
export function SegmentBar({ total, current, label }: { total: number; current: number; label?: string }) {
  return (
    <div className="flex gap-1" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-[2px] ${i < current ? 'bg-ok' : i === current ? 'bg-accent' : 'bg-surface-3'}`} />
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

/** Stavový štítek: neproporcionální písmo, velká písmena, tónovaná plocha a okraj. Barva nese význam, ne ozdobu. */
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'ok' | 'accent' | 'danger' }) {
  const tones = {
    muted: 'border-border bg-surface-2 text-muted',
    warn: 'border-warn bg-warn/12 text-warn',
    ok: 'border-ok bg-ok/12 text-ok',
    accent: 'border-accent bg-accent/12 text-accent',
    danger: 'border-danger bg-danger/12 text-danger',
  };
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase leading-4 tracking-wide ${tones[tone]}`}>{children}</span>;
}

/** Štítek obsahu, který ještě neprošel odbornou kontrolou. */
export function ReviewBadge() {
  return <Badge tone="warn">⚠ čeká na odbornou kontrolu</Badge>;
}

/** Posuvník s krokovými tlačítky ± pro přesné nastavení jedním palcem. */
export function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, step, unit, onChange } = props;
  const clamp = (next: number) => Math.min(max, Math.max(min, Number(next.toFixed(6))));
  const shown = props.format ? props.format(value) : String(value).replace('.', ',');
  const id = `slider-${label.replace(/\W+/g, '-')}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-ui">{label}</label>
        <output htmlFor={id} className="font-mono text-xl font-medium tabular-nums">{shown}<span className="text-sm font-normal text-muted">{'\u2009'}{unit}</span></output>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button variant="secondary" className="!min-h-12 !w-12 !px-0 text-xl" aria-label={`${label}: ubrat`} onClick={() => onChange(clamp(value - step))}>−</Button>
        <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--fill': `${((value - min) / (max - min || 1)) * 100}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
        <Button variant="secondary" className="!min-h-12 !w-12 !px-0 text-xl" aria-label={`${label}: přidat`} onClick={() => onChange(clamp(value + step))}>+</Button>
      </div>
    </div>
  );
}
