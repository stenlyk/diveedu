# PLAN.md – DiveEdu: PWA výuková aplikace technického potápění (OC)

Stav: **Etapa 0 schválena 2026-11-12. Etapa 1 hotová, čeká na kontrolu.** Zdroj zadání: `SPEC.md` (export z 2026-11-12).
Tento plán pokrývá architekturu, schémata obsahu, seznam modulů, pořadí práce a detailní
seznam lekcí a uzlů grafu pro moduly 0–1.

> Aplikace je výuková. Není to plánovač ponorů ani náhrada kurzu s instruktorem.
> Tato věta se propíše do onboardingu, každé kalkulačky, deko simulátoru a případových studií.

---

## 1. Rozhodnutí, která plán dělá

Volby ze SPEC přebírám beze změny, pokud není uvedeno jinak. Vlastní rozhodnutí jsou označena **(moje volba)**.

| Oblast | Rozhodnutí | Proč |
| --- | --- | --- |
| Framework | Vite + React 19 + TypeScript strict | Dle SPEC; statický výstup, žádný backend |
| Balíčky | npm workspaces: `calc`, `deco`, aplikace v kořeni **(moje volba)** | `calc/` a `deco/` nemohou omylem importovat UI; lint pravidlo to hlídá |
| Router | React Router, lazy routes, `base` konfigurovatelný **(moje volba)** | Funguje na Cloudflare Pages i GitHub Pages (podadresář) |
| PWA | vite-plugin-pwa, strategie `injectManifest` nepotřebujeme → `generateSW` | Precache jádra + obsahu; média runtime cache po balíčcích |
| Obsah | MDX (tělo lekce) + YAML (metadata, otázky, graf, případovky), Zod validace při buildu | Chybný obsah zastaví build; obsah lze upravovat bez programování |
| Matematika | KaTeX, jen woff2 fonty | Rozpočet 1,5 MB |
| Data uživatele | Dexie (IndexedDB) | Dle SPEC |
| Opakování | ts-fsrs | Dle SPEC |
| Globální graf | Cytoscape.js (canvas), lazy chunk **(moje volba z nabídnutých dvou)** | Dotyková gesta a hit-testing hotové, 300+ uzlů plynule; d3-force by znamenal psát pan/zoom/tap ručně |
| Lokální graf | Vlastní SVG komponenta se sloupci (příčiny vlevo → pojem → důsledky vpravo) **(moje volba)** | Odpovídá vizuálnímu jazyku ukázky ve SPEC; deterministický layout, čitelný na 360 px |
| Vizualizace | d3-scale + d3-shape + vlastní React SVG místo visx **(moje volba)** | Menší bundle, plná kontrola nad dotykem; visx přidám jen, pokud v etapě 4 ušetří práci |
| Stav | Zustand (UI stav), Dexie `liveQuery` (perzistentní data) | Jedna pravda pro perzistenci = IndexedDB |
| Styl | Tailwind v4 + design tokeny v CSS proměnných, tmavý režim výchozí | Dle SPEC |
| Testy | Vitest (`calc`, `deco`, obsah), Playwright (toky, offline, mobilní viewport) | `calc/` 100 % větví vynuceno prahem v CI |
| Hosting/CI | Statický build; GitHub Actions: lint → typecheck → testy → validace obsahu → build → Lighthouse CI | Cíl hostingu viz otevřené otázky |

## 2. Rozhraní: primárně mobil, plně i desktop

Návrh se dělá pro 360–430 px a rozšiřuje se nahoru, ne naopak.

**Mobil (< 768 px)**
- Spodní navigace s 5 položkami v dosahu palce: **Domů · Učení · Trénink · Graf · Nástroje**.
- Primární akce vždy ve spodní třetině obrazovky; dotykové plochy ≥ 48 px; žádná akce závislá na hoveru.
- Domů: nahoře stav (série dní, karty k opakování), dole dvě velká tlačítka **Rychlý check** a **Denní opakování**.
  Rychlý check = klepnutí 1 (tlačítko) + klepnutí 2 (první odpověď) → splňuje akceptační kritérium „do 2 klepnutí“.
- Lekce: jedna sekce šablony = jedna „stránka“ se svislým scrollem, postup mezi sekcemi tlačítkem dole nebo swipe; ukazatel 1–9.
- Numerické vstupy: vlastní číselná klávesnice v dolní části (režim Z hlavy na čas nesmí čekat na systémovou klávesnici), `inputmode="decimal"` jinde; desetinná čárka i tečka.
- Posuvníky s krokovými tlačítky ± pro přesné nastavení jedním palcem.
- Respektuje `safe-area-inset-*`, `prefers-reduced-motion`, orientaci na výšku i na šířku (simulátory na šířku dostanou víc místa).

**Tablet / desktop (≥ 768 / ≥ 1024 px)**
- Spodní navigace se změní na levý boční panel; obsah max. ~72 znaků na řádek.
- Dvousloupcové rozložení tam, kde to pomáhá: lekce + lokální graf/hračka vedle textu, kalkulačka + rozepsaný postup, graf + detail uzlu.
- Klávesové zkratky v kvízu (1–4 volba, Enter potvrdit, mezerník další) a v tréninku z hlavy.

**Společné**
- Jedna sada komponent, rozložení řízené breakpointy a container queries; žádná oddělená „mobilní verze“.
- Tmavý režim výchozí, světlý volitelný; kontrast ≥ 4,5:1; zvládnutí se nekóduje jen barvou (červená/žlutá/zelená + ikona/tvar).
- Playwright testy běží ve dvou projektech: Pixel 7 / iPhone 14 viewport a desktop 1280×800.

## 3. Architektura

```
/calc        @diveedu/calc – čisté funkce + testy; žádná závislost mimo TS
/deco        @diveedu/deco – Bühlmann ZHL-16C + GF, jen pro výuku; závisí jen na calc
/content     modules/<id>/module.yaml
             modules/<id>/lessons/<lessonId>/lesson.yaml + lesson.mdx
             modules/<id>/questions/*.yaml
             graph/concepts.yaml, graph/relations.yaml
             formulas.yaml, glossary.yaml, facts.yaml, media.yaml
             cases/<caseId>.yaml
/media       audio, obrázky, videa po modulech (etapa 6)
/src
  app/         router, layout (BottomNav / SideNav), PWA registrace, update prompt
  features/    home, learn, lesson, train, exam, graph, tools (kalkulačky), cases, settings
  components/  ui (tlačítka, slider, numpad), math (KaTeX), graph (LocalGraph), charts
  mdx/         komponenty dostupné v lekcích: <Calc>, <Worked>, <Playground>, <Formula>, <Term>, <Fact>
  content/     načtení zkompilovaného obsahu, typy generované ze Zod schémat
  db/          Dexie schéma, migrace, export/import
  srs/         obal nad ts-fsrs, výpočet zvládnutí uzlu
  quiz/        engine otázek: generátor numerických variant, vyhodnocení, vysvětlení chyb
/scripts     validate-content, check-graph-links, extract-worked-tests, gen-review, (gen-tts v etapě 6)
/e2e         Playwright
```

**Tok dat.** Build: `scripts/validate-content` načte YAML/MDX → Zod → křížové kontroly (existence id, pokrytí) → vygeneruje `content.generated.json` + lazy MDX chunky po modulech. Běh: UI čte obsah (neměnný), zapisuje jen do IndexedDB. Výpočty jdou vždy `UI → quiz/tools → @diveedu/calc`.

**Jeden zdroj pravdy pro čísla.**
- V MDX se čísla nepíšou ručně: `<Calc fn="mod" args={{ fO2: 0.32, ppO2Max: 1.4 }} />` vykreslí výsledek přes `calc`.
- `<Worked id="…">` definuje řešený příklad (vstupy + ručně spočtená `expected`). Zobrazené číslo jde z `calc`; `scripts/extract-worked-tests` z každého `<Worked>` vygeneruje test `calc === expected ± tolerance`. Tím se plní „každý řešený příklad je test“.
- Lint pravidlo nad MDX: číslo s jednotkou (`m`, `bar`, `g/l`, `%`, `OTU`, `l`) mimo `<Calc>/<Worked>` v sekcích *formula* a *worked* = chyba buildu; jinde varování s možností výjimky `{/* literal-ok: důvod */}` (např. historická data).

**Offline.** Precache: app shell, JS/CSS chunky, veškerý text, otázky, graf, KaTeX fonty. Runtime cache (Cache Storage, `CacheFirst`) pro `/media/<modul>/…`; balíček modulu se stahuje explicitně z Nastavení přes manifest souborů, s ukazatelem velikosti a možností smazat. Update: prompt „Je k dispozici nová verze“, žádný tichý reload uprostřed kvízu. Žádné externí requesty za běhu (fonty, CDN) → žádná telemetrie.

**Rozpočet prvního načtení (< 1,5 MB bez médií).** Lazy: Cytoscape, simulátory, zkouška, MDX modulů mimo aktuální. Kontrola velikosti je krok CI.

## 4. Balíček `calc/`

Zásady: čisté funkce, žádné zaokrouhlování uvnitř (zaokrouhluje až zobrazení, a to bezpečným směrem – MOD dolů, spotřeba nahoru), jednotky v názvech parametrů, neplatný vstup vyhodí `CalcInputError` (frakce mimo 0–1, součet > 1, záporná hloubka). Každá funkce má i variantu `…Steps()` vracející rozepsaný postup pro režim „Spočti mi“ a pro zpětnou vazbu v „Spočítám sám“.

Prostředí: výchozí `{ metersPerBar: 10, surfaceBar: 1 }`; volitelný parametr `env` pro sladkou vodu (10,3 m/bar) a nadmořskou výšku – používá se jen v lekcích, které o tom mluví.

| Soubor | Funkce | Etapa |
| --- | --- | --- |
| `pressure.ts` | `absPressure`, `depthFromPressure`, `boyleVolume`, `gayLussacPressure` | 1 |
| `gas.ts` | `Gas {fO2, fHe}`, `fN2`, `validateGas`, předvolby (vzduch, EAN32, EAN50, O2, Tx18/45…) | 1 |
| `oxygen.ts` | `ppO2`, `mod`, `bestMix`, `minDepthForPpO2` (hypoxický mix), `cnsPercent` (NOAA + lineární interpolace), `cnsMultiSegment`, `otu`, `otuMultiDay` | 1 |
| `narcosis.ts` | `ead`, `end({ o2Narcotic })`, `ppN2` | 1 |
| `density.ts` | `gasDensity`, `densityRating` (≤ 5,2 ok / ≤ 6,2 varování / > 6,2 limit) | 1 |
| `trimix.ts` | `optimalTrimix({ depth, ppO2Max, endMax, densityMax, o2Narcotic })`, `allowedMixRegion` (pro ternární diagram) | 1 |
| `consumption.ts` | `gasConsumed`, `sacFromLog`, `rmvFromSac`, `rockBottom`, `ruleOfThirds`, `turnPressure`, `thirdsDissimilarSac`, `thirdsDissimilarTanks` | 1 |
| `blending.ts` | `partialPressureBlend` (nitrox, trimix, doplnění zbytku), `topUpResult`, volitelně `vdwBlend` (van der Waals) | 1 |
| `icd.ts` | `icdCheck` (pravidlo 1/5: nárůst fN2 ≤ 1/5 poklesu fHe) – označeno jako konvence, ne fyzikální zákon | 1 |
| `format.ts` | bezpečné zaokrouhlení a české formátování (desetinná čárka) | 1 |

**Referenční testy ze SPEC** (všechny přepočítány ručně):

| Výpočet | Vstup | SPEC | Přepočet | Stav |
| --- | --- | --- | --- | --- |
| MOD | EAN32, 1,4 | 33,75 m | 33,75 | ✓ |
| MOD | vzduch (0,21), 1,4 | 56,7 m | 56,67 | ✓ |
| EAD | EAN32, 30 m | 24,4 m | 24,43 | ✓ |
| END (O2 nark.) | Tx 18/45, 60 m | 28,5 m | 28,50 | ✓ |
| Hustota | vzduch, 30 m | 5,17 g/l | **5,15** | ✗ viz níže |
| Hustota | Tx 18/45, 60 m | 5,60 g/l | 5,60 | ✓ |
| Best mix | 40 m, 1,4 | 0,28 | 0,28 | ✓ |
| OTU | 1,4, 30 min | 48,9 | 48,87 | ✓ |

**Nalezený rozpor ve SPEC.** Vzorec hustoty s koeficienty 1,429 / 1,251 / 0,179 dává pro vzduch 21/79 ve 30 m 4 × 1,2884 = **5,15 g/l**. Hodnota 5,17 odpovídá reálnému vzduchu (1,293 g/l při 0 °C, včetně ~0,9 % argonu). Oba údaje ze SPEC tedy nemohou platit zároveň. Návrh: test = 5,15 (věrně vzorci, který se uživatel učí počítat z hlavy), v lekci o hustotě poznámka, proč tabulky uvádějí 5,17. Potřebuji potvrzení – viz otevřené otázky.

Další testy nad rámec tabulky: hraniční hodnoty (hladina, fO2 = 1, ppO2 < 0,5 → OTU 0, ppO2 mimo tabulku NOAA → výslovný stav „mimo tabulku“, ne extrapolace), inverzní vlastnosti (`mod(bestMix(d)) ≥ d`), property testy (monotonie v hloubce).

## 5. Balíček `deco/` (etapa 4, jen výuka)

ZHL-16C (N2 + He koeficienty), Schreinerova rovnice, gradient factors (GF low/high), zastávky po 3 m, střídání plynů, výstup `tissueTimeline` pro tkáňový simulátor, GF99 a surfacing GF. Ověření: sada 10 profilů uložená jako fixtures; referenční hodnoty z otevřené implementace spustitelné v CI + ruční křížová kontrola vybraných profilů v Subsurface uživatelem; tolerance 1 min na zastávku. API vrací typ `EducationalDecoResult`, který UI neumí vykreslit bez disclaimeru.

## 6. Datový model obsahu (Zod schémata)

Přesně podle tabulky ve SPEC, doplněno o pole potřebná pro validaci:

- **Module** `id, title, branch: depth|cave|cross, rig: oc|ccr, prerequisites[], order, passThreshold (výchozí 0.8), unlockAfter?` (pro průřezové moduly)
- **Lesson** `id, moduleId, title, order, conceptIds[], estimatedMinutes, sources[], needs_review, audioSummary (text)`; tělo v `lesson.mdx` s povinnými obaly `<Hook> <Principle> <FormulaSection> <WorkedSection> <PlaygroundSection> <Links> <RealWorld> <Check> <AudioSummary>` – validátor projde MDX AST a ověří všech 9.
- **Concept** `id, label, type: quantity|gas|physiology|procedure|equipment|risk|formula, shortDefinition, lessonIds[], formulaId?, moduleId`
- **Relation** `from, to, type: zvysuje|snizuje|zpusobuje|zhorsuje|zmirnuje|pocita_se_z|je_predpokladem|vedlo_k, explanation (1 věta), lessonId`
- **Formula** `id, latex, variables[{symbol, name, unit}], calcFunction` – validátor ověří, že `calcFunction` je exportem `@diveedu/calc`.
- **Question** `id, type: choice|multi|numeric|why|order|match|findError|diagram|scenario, conceptIds[1..3], difficulty 1–5, prompt, options[{text, correct, explanation}] | template{fn, params{min,max,step|values}, tolerance, unit}, explanation, backToLessonId, sources[], needs_review`
- **CaseStudy**, **Fact**, **GlossaryTerm**, **Media** – dle SPEC; `CaseStudy.rig` a `Module.rig` připravují CCR větev.

**Křížové kontroly při buildu** (chyba = build spadne): unikátní id; každá reference existuje; lekce má 9 sekcí a ≥ 2 relace; uzel má ≥ 1 lekci a ≥ 3 otázky; případovka má zdroje a `certainty`; každá špatná možnost má vysvětlení; numerická šablona odkazuje na existující funkci a všechny kombinace parametrů dají platný vstup; modul má ≥ 40 otázek; graf prerekvizit je acyklický. `scripts/gen-review` vypíše vše s `needs_review: true` do `REVIEW.md`.

**Data uživatele (Dexie, verze schématu 1)**: `progress`, `answers`, `cards` (FSRS), `mastery`, `settings`, `reports` (nahlášené chyby), `examAttempts`. Export/import: jeden JSON s `schemaVersion`, validovaný Zodem při importu, volba sloučit/nahradit.

## 7. Moduly a etapy

| Etapa | Obsah | Hotovo, když |
| --- | --- | --- |
| 0 | Tento plán | Schváleno |
| 1 Jádro | Kostra PWA + layout mobil/desktop, onboarding s disclaimerem, `calc/` komplet, schémata + validátor, Dexie + export/import, CI | Testy zelené, `calc` 100 % větví, instalace a běh offline ověřen Playwrightem |
| 2 První modul | Moduly 0 a 1: lekce, kalkulačky (3 režimy – „Z hlavy“ až v et. 3), 40+ otázek na modul, 2 případovky, graf + lokální pohled | Validátor bez chyb, žádný ručně psaný výsledek |
| 3 Trénink | FSRS, Z hlavy na čas, zkouška modulu, slabiny, rychlý check, dashboard, globální graf | MVP použitelné denně |
| 4 Hloubka | Moduly 2–4, `deco/`, tkáňový simulátor, ternární diagram, profil ponoru, případovky | Deko ověřeno, REVIEW.md aktuální |
| 5 Jeskyně | C1–C3, navigační mapa, scénáře v nulové viditelnosti | Hratelné jednou rukou |
| 6 Média | TTS, podcast režim, animace/videa, balíčky | Audio u každé lekce |

Průřezové moduly (Fyziologie a medicína, Vybavení, Lidský faktor, Nouzové situace) vznikají průběžně: jejich lekce se píšou v etapě, ve které se odemykají (pole `unlockAfter`).

**Pořadí práce v etapě 1**
1. Repo: workspaces, TS strict, ESLint (zákaz importu UI z `calc`/`deco`), Prettier, Vitest, Tailwind, tokeny.
2. `calc/` metodou test-first: nejdřív referenční tabulka jako padající testy, pak implementace, pak hraniční případy do 100 % větví.
3. Zod schémata + `validate-content` + minimální ukázkový obsah (1 modul, 1 lekce, 3 otázky, 3 uzly) jako fixture, včetně záměrně chybných fixtures pro testy validátoru.
4. App shell: router, BottomNav/SideNav, onboarding s povinným potvrzením, Nastavení.
5. Dexie + export/import + test round-tripu.
6. PWA: manifest, ikony, service worker, update prompt; Playwright test „po první návštěvě funguje offline“ na mobilním i desktopovém viewportu.
7. CI workflow + kontrola velikosti bundle.
8. Shrnutí etapy s výpisem testů; stop.

## 8. Modul 0 – Základy fyziky a fyziologie (lekce)

| # | Lekce | Hlavní uzly | Výpočet / hračka |
| --- | --- | --- | --- |
| 0.1 | Tlak a hloubka | hloubka, absolutní tlak | `absPressure`; posuvník hloubky |
| 0.2 | Boyleův zákon: objem a hloubka | objem plynu, vztlak, barotrauma plic | `boyleVolume`; simulátor Balonek a hloubka |
| 0.3 | Hustota dýchaného plynu roste s hloubkou | hustota plynu, práce dýchání | `gasDensity` (jen vzduch; plně až v modulu 3) |
| 0.4 | Daltonův zákon: parciální tlaky | parciální tlak, ppO2, ppN2 | `ppO2`; skládaný sloupec složek |
| 0.5 | Henryho zákon: plyn se rozpouští | rozpustnost, sycení tkání, DCS (úvod) | animace sycení (kvalitativní) |
| 0.6 | Teplota a tlak v lahvi | teplota, tlak v lahvi | `gayLussacPressure` |
| 0.7 | Vztlak a trim | vztlak, trim | Archimedes; vyvážení s plnou a prázdnou lahví |
| 0.8 | Světlo, zvuk a teplo ve vodě | ztráta tepla, vnímání pod vodou | kvalitativní; pohlcování barev |
| 0.9 | Dýchání: plíce, výměna plynů, CO2 jako řídicí signál | retence CO2, námaha, práce dýchání, hypoxie | – |
| 0.10 | Oběh a transport plynů | transport kyslíku, sycení tkání | základ pro kyslíkové okno |
| 0.11 | Uši, sinusy a vyrovnání tlaku | barotrauma ucha, vyrovnání tlaku | Boyle na středouší |

## 9. Modul 1 – Advanced Nitrox (lekce)

| # | Lekce | Hlavní uzly | Výpočet / hračka |
| --- | --- | --- | --- |
| 1.1 | Proč nitrox: méně dusíku za cenu kyslíku | nitrox, fO2, ppN2 | porovnání vzduch vs. EAN |
| 1.2 | ppO2 a maximální operační hloubka | ppO2, MOD, překročení MOD | `ppO2`, `mod` |
| 1.3 | Kyslíková toxicita CNS | CNS toxicita, retence CO2, námaha | lokální graf dle ukázky ve SPEC |
| 1.4 | CNS hodiny | CNS % | `cnsPercent`; tabulka NOAA |
| 1.5 | Plicní toxicita a OTU | plicní toxicita, OTU | `otu`, vícedenní souhrn |
| 1.6 | Ekvivalentní vzduchová hloubka | EAD, ppN2 | `ead` |
| 1.7 | Best mix | best mix, MOD | `bestMix` |
| 1.8 | Kyslíkové okno | kyslíkové okno, transport kyslíku | animace art./ven. parciálních tlaků |
| 1.9 | Analýza plynu a značení lahví | analýza plynu, analyzátor, značení lahví, záměna plynu | – |
| 1.10 | EAN50 a kyslík na dekompresi, protokol přepnutí | EAN50, kyslík, přepnutí plynu, deko lahev | `mod` při 1,6 |
| 1.11 | Kyslíková kompatibilita a čistota | kyslíková čistota, kyslíkový požár | – |
| 1.12 | Míchání parciálním tlakem a doplňování | míchání, reálný plyn | `partialPressureBlend`, `topUpResult` |

Kalkulačky v etapě 2: ppO2, MOD, EAD, best mix, CNS/OTU, míchání nitroxu, Boyle. Ostatní (END, hustota směsí, trimix, spotřeba, ICD) mají funkce v `calc/` už z etapy 1, UI dostanou s moduly 2–4.

**Případovky etapy 2** (obě `needs_review: true`, fakta jen z dohledatelných zdrojů, jinak označeno jako hypotéza):
1. Blue Hole Dahab, 2000 – narkoza a ztráta kontroly klesání na vzduchu (uzly: hloubka, ppN2, narkoza, ppO2, překročení MOD).
2. Kyslíkové křeče po přepnutí na špatnou lahev – anonymizovaný vzorec z hlášení DAN (uzly: značení lahví, přepnutí plynu, záměna plynu, CNS toxicita).

## 10. Uzly grafu pro moduly 0–1 (50)

| Typ | Uzly |
| --- | --- |
| Fyzikální veličina (12) | hloubka, absolutní tlak, objem plynu, hustota plynu, teplota, tlak v lahvi, parciální tlak, ppO2, ppN2, rozpustnost plynu, vztlak, trim |
| Plyn a směs (6) | vzduch, kyslík, dusík, nitrox, frakce kyslíku (fO2), EAN50 |
| Fyziologický jev (14) | sycení tkání, DCS, dusíková narkoza, CNS toxicita, plicní toxicita, hypoxie, retence CO2, práce dýchání, námaha, transport kyslíku, kyslíkové okno, ztráta tepla, barotrauma ucha, barotrauma plic |
| Vzorec (8) | P_abs, Boyle, Dalton, MOD, EAD, best mix, CNS %, OTU |
| Postup (5) | vyrovnání tlaku, analýza plynu, značení lahví, přepnutí plynu, míchání parciálním tlakem |
| Vybavení (2) | analyzátor kyslíku, deko lahev |
| Riziko (3) | záměna plynu, překročení MOD, kyslíkový požár |

Příklady relací (každá s jednovětným vysvětlením a lekcí): hloubka →`zvyšuje`→ absolutní tlak; absolutní tlak →`zvyšuje`→ ppO2, ppN2, hustota plynu; hustota plynu →`zvyšuje`→ práce dýchání →`způsobuje`→ retence CO2 →`zhoršuje`→ narkoza, CNS toxicita; námaha →`zvyšuje`→ retence CO2; fO2 →`zvyšuje`→ ppO2; fO2 →`snižuje`→ ppN2; MOD →`počítá se z`→ fO2, ppO2; analýza plynu →`zmírňuje`→ záměna plynu; záměna plynu →`způsobuje`→ překročení MOD →`způsobuje`→ CNS toxicita. Cíl: ~110 relací pro moduly 0–1.

Pokrytí: 50 uzlů × 3 otázky = min. 150 vazeb otázka→uzel. Plán: ~55 otázek na modul (z toho ~12 numerických šablon), průměrně 1,6 uzlu na otázku → ~175 vazeb. Validátor pokrytí vynucuje.

## 11. Trénink a zvládnutí (etapa 3, návrh)

- Karta FSRS = otázka (u numerických šablona; každé zobrazení nová varianta). Hodnocení odvozené z výsledku a času: špatně → Again, správně pomalu → Hard, správně → Good, správně rychle → Easy; uživatel může přepsat.
- Zvládnutí uzlu = exponenciálně vážený průměr správnosti (poločas 30 dní), váha podle obtížnosti; < 3 odpovědi = „neznámé“ (šedá, ne červená).
- Z hlavy na čas: úrovně podle „hezkosti“ čísel (10m kroky a EAN32 → libovolná hloubka a trimix), tolerance ±1 m / ±0,02 bar dle SPEC, tipy na odhad (např. MOD při 1,4 ≈ 14/fO2 − 10).
- Zkouška modulu: 40–60 otázek losovaných stratifikovaně přes uzly, limit času, bez vysvětlení v průběhu, práh 80 %.

## 12. Odborný obsah a bezpečnost

- Každá lekce má `sources[]`; sporná témata jako debata se stranami (narkotičnost O2 už v modulu 1 jen zmínkou, plně v modulu 3).
- Nejistý fakt → `needs_review: true` + viditelný štítek „čeká na odbornou kontrolu“ + řádek v `REVIEW.md`. Detaily nehod se nedomýšlejí.
- Limity se uvádějí se zdrojem a s poznámkou o rozdílech mezi agenturami (ppO2 1,4 / 1,6; END 30 m; hustota 5,2 / 6,2 g/l).
- Disclaimer je komponenta `<Disclaimer kind="calc|deco|case">`, kterou kalkulačky a simulátory nemohou vynechat (součást jejich layoutu).

## 13. Rizika

| Riziko | Dopad | Opatření |
| --- | --- | --- |
| Faktická chyba v obsahu | Bezpečnostní | Čísla jen z `calc`, zdroje, `needs_review`, REVIEW.md, kontrola uživatelem po každé etapě |
| iOS Safari: limity úložiště a PWA | Ztráta dat, audio offline | `navigator.storage.persist()`, export pokroku, test na reálném iPhonu v etapě 1 |
| Rozsah obsahu (150+ otázek/modul) | Čas | MVP 40–55 otázek/modul, numerické šablony násobí variabilitu |
| Výkon grafu na mobilu | UX | Canvas renderer, lazy load, filtr po modulech jako výchozí pohled |
| Reference pro deko | Nelze ověřit automaticky proti Subsurface GUI | Otevřená referenční implementace v CI + ruční křížová kontrola |
| TTS vyžaduje placenou službu | Etapa 6 | Rozhodnutí o poskytovateli až před etapou 6; fallback Web Speech API |

## 14. Rozhodnutí ze schválení (2026-11-12)

1. **Hustota vzduchu ve 30 m:** test na 5,15 g/l dle vzorce; poznámka o 5,17 g/l (reálný vzduch s argonem) přijde do lekce o hustotě.
2. **Hosting:** Cloudflare Pages (`npm run deploy`, viz README).
3. **Git:** repozitář inicializován, commit po dokončení každé etapy.
4. **Název:** DiveEdu.

## 15. Odchylky od plánu zjištěné při etapě 1

- Vitest 3.2 místo 5.x a TypeScript 6.0 místo 7.0: novější verze nejsou kompatibilní s Node 23.7 / typescript-eslint.
- Lint „žádné ručně psané číslo v MDX“ je odložen na etapu 2, až budou existovat reálné lekce a půjde nastavit pravidlo bez falešných poplachů. Řešené příklady (`<Worked>`) se proti ruční referenci kontrolují už teď.
- Vzorce v lekcích jdou přes `<Formula id>` z `formulas.yaml` (entita Formula ze SPEC), ne přes `$…$` v textu.
- Typy otázek `diagram` a `scenario` doplní schéma v etapách 4 a 5 spolu s komponentami, které je vykreslí (rozšíření je aditivní).
- `vdwBlend` (van der Waals, ve SPEC „volitelně“) a jeskynní rozšíření turn pressure (proud, skútr) přijdou s moduly 3 a C2.
- Stav etap: 0 ✓ · 1 ✓ (čeká na kontrolu) · 2–6 nezahájeno.
