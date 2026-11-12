import { useState } from 'react';
import { Button, Card } from '../components/ui';
import { DISCLAIMER_VERSION, useSettings } from '../db/settings';

/** První spuštění: uživatel musí výslovně potvrdit, že aplikace není plánovač ani náhrada kurzu. */
export function Onboarding() {
  const set = useSettings((state) => state.set);
  const [checked, setChecked] = useState(false);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">DiveEdu</h1>
      <p className="mt-2 text-muted">Teorie technického potápění od Advanced Nitrox po Full Trimix a Full Cave. Princip, výpočet, reálný ponor.</p>
      <Card className="mt-6 border-warn/60">
        <h2 className="text-lg font-semibold">Než začneš</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>Aplikace <strong>nenahrazuje kurz ani instruktora</strong>. Učí teorii, ne dovednosti pod vodou.</li>
          <li>Aplikace <strong>není plánovač ponorů</strong>. Výpočty, dekompresní simulace i kalkulačky jsou ilustrativní a slouží jen k výuce.</li>
          <li>Obsah označený štítkem „čeká na odbornou kontrolu“ ještě neprošel revizí.</li>
          <li>Tvůj pokrok zůstává jen v tomto zařízení. Nic se neodesílá.</li>
        </ul>
        <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[var(--accent)]" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>Rozumím, že aplikace slouží jen k výuce teorie a nepoužiji ji k plánování skutečných ponorů.</span>
        </label>
      </Card>
      <Button className="mt-6 w-full" disabled={!checked} onClick={() => void set('disclaimerAccepted', DISCLAIMER_VERSION)}>
        Začít
      </Button>
    </main>
  );
}
