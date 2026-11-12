# DiveEdu

Offline-first PWA pro výuku teorie technického potápění (OC) v češtině. Zadání je v `SPEC.md`, plán a stav etap v `PLAN.md`.

> Aplikace nenahrazuje kurz, instruktora ani plánovač ponorů. Výpočty jsou ilustrativní.

## Spuštění

```bash
npm install
npm run dev        # vývoj na http://localhost:5173
npm run build      # validace obsahu + typecheck + build + kontrola velikosti jádra
npm run preview    # produkční build na http://localhost:4173 (se service workerem)
```

## Kontroly

| Příkaz | Co dělá |
| --- | --- |
| `npm run test:coverage` | Jednotkové testy; `calc/` musí mít 100 % pokrytí větví |
| `npm run content` | Validace `/content`, zápis `REVIEW.md` |
| `npm run e2e` | Playwright na mobilním i desktopovém viewportu, včetně offline režimu |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript strict |
| `npm run check` | Všechno výše najednou |

## Struktura

```
calc/      čisté výpočty + testy (jediné místo, kde se počítá)
deco/      Bühlmann ZHL-16C + GF, jen pro výuku (etapa 4)
content/   moduly, lekce (MDX + YAML), otázky, graf, slovník
src/       aplikace
scripts/   validace obsahu, ikony, kontrola velikosti
e2e/       Playwright testy
docs/      poznámky k odborné kontrole výpočtů
```

## Jak upravit obsah bez programování

- Lekce: `content/modules/<modul>/lessons/<lekce>/lesson.mdx` (text) a `lesson.yaml` (metadata, zdroje, shrnutí pro audio).
- Otázky: `content/modules/<modul>/questions/*.yaml`.
- Graf: `content/graph/concepts.yaml` a `relations.yaml`.
- Čísla, která jdou spočítat, se nepíšou ručně: `<Calc fn="mod" args={[0.32, 1.4]} unit="m" />`.
- Po úpravě spusť `npm run content`. Chyba vypíše soubor a pole a zastaví build.
- Nejistý fakt označ `needs_review: true` – objeví se se štítkem v aplikaci a v `REVIEW.md`.

## Zvuk

```bash
npm run tts            # vygeneruje chybějící a změněná shrnutí do public/media (jen macOS, hlas Zuzana)
npm run tts -- --all   # přegeneruje všechno
```

Zvuk se čte systémovým hlasem počítače, nic se neposílá ven. Výstup (asi 14 MB) není v gitu.
Bez něj aplikace funguje dál a shrnutí čte systémový hlas zařízení. Zkratky se čtou podle slovníku v `src/audio/pronounce.ts`;
nová zkratka v názvu nebo shrnutí lekce bez záznamu ve slovníku zastaví build.

## Nasazení (Cloudflare Pages)

```bash
npx wrangler login                                   # jednorázově, otevře prohlížeč
npx wrangler pages project create diveedu --production-branch main   # jednorázově
npm run tts                                          # zvuková shrnutí; bez nich se nasadí verze bez nahraného hlasu
npm run deploy
```

Pro nasazení do podadresáře (např. GitHub Pages) nastav `BASE_PATH=/diveedu/ npm run build`.
