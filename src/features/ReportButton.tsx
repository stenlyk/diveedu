import { useState } from 'react';
import { Button } from '../components/ui';
import { db, type ReportRow } from '../db/db';

/** Nahlášení chyby v obsahu: záznam se uloží lokálně a exportuje se se zálohou pokroku. */
export function ReportButton({ kind, targetId }: { kind: ReportRow['kind']; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  if (saved) return <p className="text-sm text-ok">Díky, záznam je uložený v zařízení. Exportuješ ho v Nastavení.</p>;
  if (!open) return <Button variant="ghost" className="!px-0" onClick={() => setOpen(true)}>Nahlásit chybu v obsahu</Button>;
  return (
    <form onSubmit={(event) => { event.preventDefault(); void db.reports.add({ at: Date.now(), kind, targetId, note: note.trim() }).then(() => setSaved(true)); }}>
      <label className="block text-sm font-medium text-text" htmlFor="report-note">Co je špatně?</label>
      <textarea id="report-note" required rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-bg p-3 text-text" />
      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={note.trim() === ''}>Uložit</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
      </div>
    </form>
  );
}
