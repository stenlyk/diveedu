import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button, Card } from '../components/ui';

/**
 * Neznámá adresa. Častá příčina je starší verze aplikace uložená v zařízení, která novou stránku ještě nezná,
 * proto se tu hned ptáme service workeru na aktualizaci; najde-li ji, objeví se nabídka „Aktualizovat“.
 */
export function NotFound() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
  }, []);
  return (
    <Card className="max-w-xl">
      <h1 className="text-xl font-bold">Stránka nenalezena</h1>
      <p className="mt-2 text-sm text-muted">Buď adresa neexistuje, nebo máš v zařízení starší verzi aplikace, která tuto stránku ještě nezná. Pokud se objeví nabídka nové verze, zvol „Aktualizovat“.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>Načíst znovu</Button>
        <Link to="/" className="inline-flex min-h-12 items-center rounded-xl border border-border px-5 font-semibold">Na úvod</Link>
      </div>
    </Card>
  );
}
