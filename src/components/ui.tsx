import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors disabled:opacity-45 disabled:pointer-events-none select-none';
const variants = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-text border border-border hover:border-accent',
  ghost: 'text-accent hover:bg-surface-2',
  danger: 'bg-surface-2 text-danger border border-danger/60 hover:bg-danger/10',
} as const;
type Variant = keyof typeof variants;

export function Button({ variant = 'primary', className = '', ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </header>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'ok' | 'accent' }) {
  const tones = {
    muted: 'border-border text-muted',
    warn: 'border-warn/60 text-warn',
    ok: 'border-ok/60 text-ok',
    accent: 'border-accent/60 text-accent',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
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
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-muted">{label}</label>
        <output htmlFor={id} className="text-lg font-semibold tabular-nums">{shown} {unit}</output>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button variant="secondary" className="!min-h-12 !w-12 !px-0 text-xl" aria-label={`${label}: ubrat`} onClick={() => onChange(clamp(value - step))}>−</Button>
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <Button variant="secondary" className="!min-h-12 !w-12 !px-0 text-xl" aria-label={`${label}: přidat`} onClick={() => onChange(clamp(value + step))}>+</Button>
      </div>
    </div>
  );
}
