/** Nastavení aplikace: stav v paměti (Zustand) zrcadlený do IndexedDB. */
import { create } from 'zustand';
import { db } from './db';

export interface Settings {
  theme: 'dark' | 'light';
  /** Verze disclaimeru, kterou uživatel potvrdil; 0 = nepotvrzeno. */
  disclaimerAccepted: number;
}

export const DISCLAIMER_VERSION = 1;
const DEFAULTS: Settings = { theme: 'dark', disclaimerAccepted: 0 };

interface SettingsStore extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    try {
      const rows = await db.settings.toArray();
      const stored = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<Settings>;
      set({ ...DEFAULTS, ...stored, loaded: true });
    } catch {
      // IndexedDB nedostupná (např. soukromé okno): aplikace běží, jen si nic nepamatuje.
      set({ loaded: true });
    }
  },
  set: async (key, value) => {
    set({ [key]: value } as Partial<Settings>);
    try {
      await db.settings.put({ key, value });
    } catch {
      /* viz load */
    }
  },
}));
