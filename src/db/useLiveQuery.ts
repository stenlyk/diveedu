import { liveQuery } from 'dexie';
import { type DependencyList, useEffect, useState } from 'react';

/** Reaktivní dotaz do IndexedDB: překreslí komponentu při změně dat. */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({ next: setValue, error: () => setValue(undefined) });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
