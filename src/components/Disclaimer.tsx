const TEXTS = {
  general:
    'Aplikace nenahrazuje kurz, instruktora ani plánovač ponorů. Výpočty jsou ilustrativní a slouží jen k výuce teorie.',
  calc: 'Výpočet je ilustrativní a slouží jen k výuce. Neplánuj podle něj skutečný ponor – aplikace nenahrazuje kurz, instruktora ani plánovač ponorů.',
  deco: 'Dekompresní model je tu jen pro vizualizaci a výuku. Aplikace není plánovač ponorů a její výstup se nesmí použít pro skutečný ponor.',
  case: 'Případová studie vychází z veřejně dostupných zdrojů. Učíme se z rozhodnutí, ne z lidí; nejisté závěry jsou označené jako hypotéza.',
} as const;

export const DISCLAIMER_TEXT = TEXTS.general;

/** Povinné upozornění. Kalkulačky a simulátory ho mají jako pevnou součást rozložení. */
export function Disclaimer({ kind = 'general' }: { kind?: keyof typeof TEXTS }) {
  return (
    <p role="note" className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-text">
      <span aria-hidden="true">⚠ </span>
      {TEXTS[kind]}
    </p>
  );
}
