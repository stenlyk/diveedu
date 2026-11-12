import { useRef, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Button, Card, PageHeader } from '../components/ui';
import { BackupError, backupFileName, exportBackup, importBackup, parseBackup } from '../db/backup';
import { db, TABLES } from '../db/db';
import { useSettings } from '../db/settings';
import { AudioPacks } from './AudioPacks';

export function Settings() {
  const theme = useSettings((state) => state.theme);
  const set = useSettings((state) => state.set);
  const load = useSettings((state) => state.load);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmReset, setConfirmReset] = useState(false);

  const download = async () => {
    const backup = await exportBackup(db);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: backupFileName() });
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: 'ok', text: 'Záloha uložena do stažených souborů.' });
  };

  const upload = async (file: File) => {
    try {
      const count = await importBackup(db, parseBackup(await file.text()), mode);
      await load();
      setMessage({ tone: 'ok', text: `Načteno ${count} záznamů.` });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof BackupError ? error.message : 'Import se nezdařil.' });
    }
  };

  const reset = async () => {
    await Promise.all(TABLES.filter((table) => table !== 'settings').map((table) => db.table(table).clear()));
    setConfirmReset(false);
    setMessage({ tone: 'ok', text: 'Pokrok smazán.' });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Nastavení" />
      <Card>
        <h2 className="font-semibold">Vzhled</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={theme === value} onClick={() => void set('theme', value)} className={`min-h-12 rounded-xl border-2 font-semibold ${theme === value ? 'border-accent bg-accent/15' : 'border-border'}`}>
              {value === 'dark' ? 'Tmavý' : 'Světlý'}
            </button>
          ))}
        </div>
      </Card>
      <AudioPacks />
      <Card>
        <h2 className="font-semibold">Záloha pokroku</h2>
        <p className="mt-1 text-sm text-muted">Pokrok žije jen v tomto zařízení. Exportem ho přeneseš jinam nebo zazálohuješ.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void download()}>Exportovat do JSON</Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>Importovat ze souboru</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Soubor se zálohou" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
        </div>
        <fieldset className="mt-4 text-sm">
          <legend className="text-muted">Při importu</legend>
          <label className="mt-1 flex min-h-11 items-center gap-2"><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> sloučit se stávajícím pokrokem</label>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> nahradit stávající pokrok</label>
        </fieldset>
        {message && <p role="status" className={`mt-3 text-sm ${message.tone === 'ok' ? 'text-ok' : 'text-danger'}`}>{message.text}</p>}
      </Card>
      <Card>
        <h2 className="font-semibold">Smazat pokrok</h2>
        <p className="mt-1 text-sm text-muted">Smaže odpovědi, postup lekcemi i nahlášené chyby. Nastavení zůstane.</p>
        {confirmReset ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="danger" onClick={() => void reset()}>Opravdu smazat</Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Zrušit</Button>
          </div>
        ) : (
          <Button className="mt-3" variant="danger" onClick={() => setConfirmReset(true)}>Smazat pokrok…</Button>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">O aplikaci</h2>
        <Disclaimer />
        <p className="mt-3 text-sm text-muted">Verze {__APP_VERSION__}. Žádná telemetrie, žádné účty; po instalaci funguje bez připojení.</p>
      </Card>
    </div>
  );
}
