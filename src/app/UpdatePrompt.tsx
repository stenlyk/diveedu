import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/ui';

/**
 * Nabídne novou verzi; nikdy nepřenačte aplikaci sám (např. uprostřed kvízu).
 * Na mobilu je nahoře – dole jsou primární akce a nic je nesmí překrývat.
 */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  // Informace „připraveno offline“ sama po chvíli zmizí; nabídka aktualizace zůstává, dokud ji uživatel nevyřeší.
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);
  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-accent bg-surface p-3 shadow-lg md:bottom-4 md:left-auto md:right-4 md:top-auto">
      <span className="text-sm">{needRefresh ? 'Je k dispozici nová verze.' : 'Aplikace je připravená pro použití offline.'}</span>
      <span className="flex shrink-0 gap-2">
        {needRefresh && <Button className="!min-h-11 !px-4" onClick={() => void updateServiceWorker(true)}>Aktualizovat</Button>}
        <Button variant="ghost" className="!min-h-11 !px-3" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>Zavřít</Button>
      </span>
    </div>
  );
}
