# Zadání: PWA výuková aplikace technického potápění (OC)

2026-11-12 · @Stenly

Tento dokument je kompletní zadání pro Fable 5.2: exportuj ho do Markdownu, ulož jako `SPEC.md` do prázdného repozitáře a pošli níže uvedený úvodní prompt. Fable pak staví po etapách (viz poslední sekce) a po každé etapě se zastaví ke kontrole.

## Jak zadání použít

1. Export dokumentu → Markdown → `SPEC.md` v kořeni repozitáře.
2. Do Fable vlož úvodní prompt (níže) beze změn.
3. Po každé etapě zkontroluj výstup, hlavně výpočty a odborný obsah. Teprve pak pošli „Pokračuj etapou N“.
4. Obsah (lekce, kvízy, případovky) Fable generuje jako data, ne do kódu. Můžeš je tak později upravovat bez programování.

### Úvodní prompt pro Fable 5.2

```
Jsi senior full-stack vývojář a zároveň instruktor technického potápění (úroveň TDI/IANTD/GUE Full Trimix + Full Cave) a didaktik. Postav podle souboru SPEC.md offline-first PWA výukovou aplikaci technického potápění v češtině pro okruhový (OC) přístroj.

Pravidla:
1. Před psaním kódu si přečti celý SPEC.md a napiš PLAN.md: architekturu, strukturu obsahu, seznam modulů a pořadí práce. Zastav se a počkej na schválení.
2. Postupuj přesně po etapách ze sekce „Etapy dodávky“. Po každé etapě se zastav, shrň, co je hotové, co je otevřené, a vypiš výsledky testů.
3. Každý výpočet (MOD, END, EAD, ppO2, CNS, OTU, hustota plynu, míchání, spotřeba, rock bottom, turn pressure) implementuj jako čistou funkci v samostatném balíčku `calc/` se jednotkovými testy proti ručně spočteným referenčním hodnotám. UI nikdy nepočítá samo.
4. Dekompresi (Bühlmann ZHL-16C s gradient factors) implementuj jen pro vizualizaci a výuku. Všude uveď varování, že aplikace není plánovač ponorů.
5. Odborný obsah piš česky, přesně a s uvedením zdroje. Kde si nejsi jistý faktem (hlavně u případových studií nehod), označ ho `needs_review: true` a nevymýšlej detaily.
6. Obsah ukládej jako strukturovaná data (MDX/JSON dle sekce „Datový model“), ne natvrdo v komponentách.
7. Aplikace musí fungovat kompletně offline po první instalaci, včetně audia a obrázků stažených balíčků.
```

## Vize, cíle a uživatel

Cílem je „ultimátní znalostní aplikace“: potápěč v ní kdykoliv ověří, že teorii technického potápění od Advanced Nitrox po Full Trimix a Full Cave nejen zná, ale chápe v souvislostech a umí ji spočítat z hlavy.

**Cíle (měřitelné):**

- Uživatel spočítá z hlavy MOD, END, EAD, ppO2, hustotu plynu a optimální trimix s chybou do ±1 m / ±0,02 bar.
- Uživatel vysvětlí, proč daný parametr ovlivňuje jiný (např. hustota plynu → práce dýchání → CO2 retence → narkoza a riziko CNS toxicity).
- Uživatel rozebere reálnou nehodu: řetěz chyb, fyziologický mechanismus, co by ji přerušilo.
- Uživatel vidí, které oblasti má slabé, a aplikace mu je cíleně opakuje.

**Cílový uživatel:** zkušený rekreační až technický potápěč, který se připravuje na kurzy nebo si udržuje teorii. Používá telefon (cestou, na lodi bez signálu) i desktop (delší studium, simulátory).

**Mimo rozsah (zatím):** CCR, plánovač ponorů pro reálné použití, certifikace, sociální funkce. Datový model ale musí CCR později umožnit přidat jako další větev bez přepisování.

**Nevyjednatelné:** aplikace není náhrada kurzu s instruktorem ani plánovač. Upozornění je v onboardingu, u každé kalkulačky a u deko simulátoru.

## Pedagogický přístup

Výuka stojí na třech pilířích: princip → výpočet → reálný ponor. Žádný vzorec se neučí bez fyzikálního nebo fyziologického důvodu a bez příkladu, kde jeho ignorování někomu ublížilo.

**Struktura každé lekce (šablona, povinná):**

1. **Háček** – krátký reálný scénář nebo otázka („Proč potápěč ve 45 m na vzduchu neudělal jednoduchý úkon?“).
2. **Princip** – fyzika/biologie srozumitelně, s vizualizací.
3. **Vzorec a odvození** – krok za krokem, s jednotkami.
4. **Ukázkový výpočet** – řešený příklad, pak stejný typ s jinými čísly k samostatnému řešení.
5. **Interaktivní hračka** – posuvníky, kde uživatel vidí, jak změna vstupu mění výsledek.
6. **Souvislosti** – odkazy do znalostního grafu (co tento pojem ovlivňuje a čím je ovlivňován).
7. **Ze skutečnosti** – zajímavost nebo případová studie.
8. **Ověření** – 3–6 otázek, které jdou rovnou do opakování.
9. **Shrnutí pro audio** – 60–90 s mluveného shrnutí.

**Didaktické zásady:**

- Aktivní vybavování a rozložené opakování (FSRS) místo pasivního čtení.
- Otázky typu „proč“ a „co kdyby“ mají přednost před „co je“.
- Promíchávání témat v tréninku (interleaving), aby uživatel poznal, který postup použít.
- Chyby v kvízu vedou zpět na konkrétní princip, ne jen na správnou odpověď.
- Jednotky: metry, bary, litry, °C; metrická konvence 10 m = 1 bar (s poznámkou o sladké vodě a nadmořské výšce).

## Kurikulum

Kurikulum má jednu hlavní hloubkovou linii (Advanced Nitrox → Decompression Procedures → Normoxic Trimix → Full Trimix) a odbočku do jeskyní (Cavern/Intro Cave → Full Cave → Deep Cave). Společný základ a průřezové moduly se odemykají průběžně. Struktura je nezávislá na agentuře (TDI, IANTD, GUE, PSAI); kde se standardy liší, lekce to výslovně uvede.

Odemykání: modul je přístupný vždy, ale „splnit“ ho lze až po splnění prerekvizit (test ≥ 80 %). Uživatel může kdykoli spát do „zkouškového režimu“ a modul přeskočit.

### Hlavní linie

| Modul | Klíčová témata | Výpočty | Prerekvizity |
| --- | --- | --- | --- |
| 0 Základy fyziky a fyziologie | Boyle, Dalton, Henry, Charles; vztlak a trim; světlo, zvuk a teplo ve vodě; anatomie dýchání, oběhu, ucha a sinusů | Absolutní tlak, objem při změně hloubky, parciální tlak | – |
| 1 Advanced Nitrox | Kyslíková toxicita CNS a plicní, kyslíkové okno, analýza plynu, značení lahví, EAN50 a O2 na deko, kyslíková kompatibilita | ppO2, MOD, EAD, best mix, CNS % a OTU, míchání parciálním tlakem a doplňování | 0 |
| 2 Decompression Procedures | Haldane, Bühlmann ZHL-16, M-hodnoty, gradient factors, bublinové modely (VPM, RGBM), deko zastávky, střídání plynů, stage lahve, twinset a ventilový drill, ztráta deko plynu, tým | SAC/RMV, rock bottom (minimum gas), pravidlo třetin, run-time, kompartmentové saturace, GF 99 a surfacing GF | 1 |
| 3 Normoxic Trimix | Dusíková narkoza a role kyslíku, hustota plynu a práce dýchání, retence CO2, helium (tepelná vodivost, HPNS), více plynů v plánu | END (s O2 narkotickým i bez), hustota plynu g/l, optimální trimix pro danou hloubku, míchání trimixu | 2 |
| 4 Full Trimix | Hypoxické směsi, travel gas, isobaric counterdiffusion (ICD), DCS vnitřního ucha, debata o hlubokých zastávkách (NEDU 2011), tepelný management (argon), logistika expedic | Minimální ppO2 a minimální hloubka pro hypoxický mix, pravidla přepnutí He → N2, gas plan pro 3–4 plyny, OTU přes více dní | 3 |

### Jeskynní odbočka

| Modul | Klíčová témata | Výpočty | Prerekvizity |
| --- | --- | --- | --- |
| C1 Cavern / Intro Cave | Prostředí se stropem, analýza nehod Sheck Exley („Blueprint for Survival“), vodící lano, světla a signály, kontaktní komunikace, silt a viditelnost, techniky ploutvování | Pravidlo třetin, třetiny při různé SAC partnerů, turn pressure | 1 |
| C2 Full Cave | Navigace (jumps, gaps, T, cookies, šipky), ztráta lana, ztráta partnera, návrat v nulové viditelnosti, zúženiny, proud a průtok, DPV (skútr) v jeskyni, sidemount vs. backmount | Turn pressure s proudem a skútrem, rezerva na tažení partnera, výpočet vzdálenosti a času návratu | C1 |
| C3 Deep Cave (syntéza) | Kombinace trimixu, deko a stropu; deko v jeskyni, stage drops, ztráta stage | Kompletní plán hlubokého jeskynního ponoru | C2 + 3 |

### Průřezové moduly

Tyto moduly nemají vlastní úroveň; jejich lekce se odemykají podle toho, kde uživatel v hlavní linii je.

- **Fyziologie a medicína:** typy DCS, IBCAD, PFO, imerzní edem plic (IPE), hypotermie, dehydratace, AGE, barotraumata, lékařská způsobilost, první pomoc a kyslík.
- **Vybavení:** konfigurace (DIR/Hogarthian, sidemount), regulátory a dlouhá hadice, ventily a izolátor, počítače a algoritmy, svitilny, suchý oblek a argon.
- **Lidský faktor:** normalizace odchylky, model švýcarského sýra, úkolová zahlcenost, stres a panika, checklisty, týmová komunikace, rozhodování „kdokoliv může ponor kdykoliv ukončit“.
- **Nouzové situace:** out-of-gas, free-flow, vynechání deko, nekontrolovaný výstup, CNS křeče pod vodou, záchrana bezvládného potápěče.

## Znalostní graf a vizualizace souvislostí

Jádrem aplikace je znalostní graf: každý pojem (uzel) má typované vazby na ostatní a uživatel po něm může navigovat stejně jako po lekcích. Právě graf naučí provázanosti, které lineární kurz neukáže.

**Typy uzlů:** fyzikální veličina (hloubka, tlak, teplota), plyn a směs, fyziologický jev (narkoza, CNS toxicita, DCS, CO2 retence, hypotermie), postup (střídání plynů, valve drill), vybavení, riziko/nehoda, vzorec.

**Typy vazeb:** `zvyšuje`, `snižuje`, `způsobuje`, `zhoršuje`, `zmírňuje`, `počítá se z`, `je předpokladem`, `vedlo k (nehoda)`. Každá vazba má jednovětné vysvětlení a odkaz na lekci.

**Pohledy na graf:**

- **Globální mapa** – silově rozložený graf (d3-force nebo Cytoscape.js), filtr podle modulu a typu vazby; uzly obarvené podle zvládnutí (červená/žlutá/zelená).
- **Lokální okolí** – na konci každé lekce: pojem uprostřed, přímé příčiny vlevo, důsledky vpravo.
- **Řetěz příčin** – u každé nehody zvýrazněná cesta grafem od rozhodnutí k následku.
- **„Co kdyby“** – uživatel změní vstup (hloubku, směs, námahu) a graf animuje, které uzly se zhorší.

Příklad jedné provázanosti, kterou musí graf umět ukázat, je níže. Fable z něj odvodí vizuální jazyk lokálního pohledu.

> **[Diagram: ukázka lokálního pohledu grafu · hloubka → narkoza a CNS]** – sloupce Vstup → Fyzika → Fyziologie → Riziko; Hloubka → ppO2 → CNS toxicita; Hloubka → ppN2 → Narkoza; Hloubka → Hustota plynu → Práce dýchání → Retence CO2 → (zesiluje) Narkoza, (snižuje práh křečí) CNS toxicita; Helium ve směsi → (snižuje) Hustota plynu; Námaha → (zvyšuje produkci CO2) Retence CO2.

Hloubka působí přímo přes ppN2 a ppO2, ale i nepřímo: hustší plyn zvyšuje práci dýchání, hromadí se CO2 a ten zesiluje narkozu i snižuje práh kyslíkových křečí. Helium přeruší spodní cestu. Právě tento typ řetězce musí uživatel v aplikaci uvidět a umět vysvětlit.

## Interaktivní simulátory a kalkulačky

Každá kalkulačka má tři režimy: **Spočti mi** (výsledek + rozepsaný postup), **Spočítám sám** (aplikace zadá vstupy, uživatel zadá výsledek, dostane zpětnou vazbu ke kroku, kde chyboval) a **Z hlavy na čas** (viz Trénink). Všechny výpočty jsou čisté funkce v `calc/`.

### Vzorce (konvence 10 m mořské vody = 1 bar)

```latex
P_{abs} = \frac{d}{10} + 1 \qquad ppO_2 = F_{O_2} \cdot P_{abs} \qquad MOD = \left(\frac{ppO_{2,max}}{F_{O_2}} - 1\right) \cdot 10
```

```latex
EAD = \frac{1 - F_{O_2}}{0{,}79}(d + 10) - 10 \qquad END_{O_2\,narkotický} = (1 - F_{He})(d + 10) - 10
```

```latex
\rho_{plyn} = P_{abs} \cdot (1{,}429\,F_{O_2} + 1{,}251\,F_{N_2} + 0{,}179\,F_{He}) \;[g/l] \qquad OTU = t \cdot \left(\frac{ppO_2 - 0{,}5}{0{,}5}\right)^{0{,}83}
```

Spotřeba = SAC × P_abs × čas. CNS % podle tabulky NOAA s lineární interpolací. END se zobrazuje v obou variantách (O2 narkotický / nenarkotický) s vysvětlením, proč se agentury liší. Hustota plynu označuje 5,2 g/l jako doporučený a 6,2 g/l jako tvrdý limit (Anthony & Mitchell, 2016).

### Referenční hodnoty pro jednotkové testy

| Výpočet | Vstup | Očekávaný výsledek |
| --- | --- | --- |
| MOD | EAN32, ppO2 1,4 | 33,75 m |
| MOD | vzduch, ppO2 1,4 | 56,7 m |
| EAD | EAN32, 30 m | 24,4 m |
| END (O2 narkotický) | Tx 18/45, 60 m | 28,5 m |
| Hustota | vzduch, 30 m | 5,17 g/l |
| Hustota | Tx 18/45, 60 m | 5,60 g/l |
| Best mix | 40 m, ppO2 1,4 | EAN28 (0,28) |
| OTU | ppO2 1,4, 30 min | 48,9 OTU |

### Seznam kalkulaček

- ppO2, MOD, EAD, END, best mix, optimální trimix pro zadanou hloubku a limity (ppO2, END, hustota).
- CNS hodiny a OTU včetně vícedenního souhrnu.
- Spotřeba, SAC z logu ponoru, rock bottom/minimum gas, pravidlo třetin, turn pressure pro dva potápěče s různou SAC.
- Míchání: parciální tlak (nitrox, trimix, doplňování zbytku) s poznámkou o reálném plynu; volitelně van der Waals pro trimix.
- Minimální hloubka pro hypoxický mix, kontrola ICD při přepnutí plynu.

### Simulátory

| Simulátor | Co učí | Interakce |
| --- | --- | --- |
| Balonek a hloubka | Boyle, vztlak, největší změna objemu u hladiny | Posuvník hloubky, animovaný objem BCD/obleku/plic |
| Ternární diagram směsi | Proč konkrétní trimix | Trojúhelník O2/He/N2; pro zadanou hloubku vybarví oblast povolených směsí (ppO2 min/max, END, hustota); uživatel táhne bod |
| Tkáňový simulátor | Sycení a desaturace, M-hodnoty, gradient factors | 16 sloupců kompartmentů v čase; graf okolní tlak vs. tlak v tkáni s přímkami M-hodnot a GF; přehrávání profilu |
| Profil ponoru | Vliv střídání plynů a GF na deko | Kreslení profilu, přepnutí plynů, varování MOD/ICD/CNS; výhradně výukové |
| Kyslíkové okno | Proč kyslík urychluje deko | Animace parciálních tlaků v arteriální a venózní krvi |
| Míchací stanice | Postup a bezpečnost míchání | Virtuální plnění lahve, analýza, značení |
| Jeskynní navigační mapa | Jumps, gaps, markery, třetiny | 2D mapa jeskyně, uživatel plánuje trasu a sleduje tlak; scénář ztráty lana v nulové viditelnosti (zatemněná obrazovka, zvuk, haptika) |
| Rozhodovací scénáře | Řešení problémů pod tlakem | Větvený příběh s časovým limitem a stavem plynu; po skončení rozbor rozhodnutí |

## Případové studie skutečných ponorů a nehod

Každá případová studie učí jeden nebo dva principy na reálném příběhu a končí otázkou „co by řetěz přerušilo“. Fakta musí mít zdroj; spekulace o příčině se označí jako hypotéza.

**Šablona případové studie:**

1. Kontext – místo, rok, cíl ponoru, zkušenosti a vybavení (jen veřejně známé údaje).
2. Profil – graf hloubka/čas se známými událostmi, kde jsou data k dispozici.
3. Časová osa událostí.
4. Řetěz chyb v modelu švýcarského sýra – plánování, plyn, vybavení, prostředí, lidský faktor.
5. Fyziologický mechanismus – propojený na uzly znalostního grafu.
6. Spočítej si to – uživatel sám spočítá klíčové hodnoty (END, ppO2, hustota, zásoba plynu).
7. Co by řetěz přerušilo – konkrétní postupy a pravidla.
8. Zdroje.

**Pravidla citlivosti:** respekt k obětem a rodinám, žádné grafické detaily ani vkládání záznamů smrti, žádné vinění jednotlivců. Učíme se z rozhodnutí, ne z lidí.

### Kandidáti na první sadu (Fable ověří proti zdrojům)

| Případ | Hlavní lekce | Modul |
| --- | --- | --- |
| Chris a Chrissy Rouseovi, vrak U-869, 1992 | Hluboký ponor na vzduch: narkoza, zamotání, únik plynu, nekontrolovaný výstup, těžká DCS | 3 |
| Yuri Lipski, Blue Hole Dahab, 2000 | Narkoza a ztráta kontroly klesaní na vzduch; proč je Arch tak smrtelný | 1, 3 |
| Sheck Exley, Zacatón, 1994 | Hranice OC trimixu, HPNS a nejistota příčiny; jak pracovat s nevěděním | 4 |
| Saman Kunan, záchrana v Tham Luang, 2018 | Plánování plynu a dlouhé průniky v jeskyni pod tlakem záchranné akce | C1, C2 |
| Sheck Exley: analýza jeskynních nehod („Blueprint for Survival“) | Vodící lano, třetiny, hloubkové limity, světla: pravidla vzniklá z nehod | C1 |
| Eagle's Nest a jiné hluboké jeskyně na vzduch (anonymizovaný vzorec) | Narkoza + strop + bahno = ztráta orientace | C2, 3 |
| Kyslíkové křeče po přepnutí na špatnou lahev (anonymizovaný vzorec z DAN) | Značení lahví, protokol přepnutí, potvrzení partnerem | 1, 2 |
| Hypoxie na hypoxickém mixu u hladiny (anonymizovaný vzorec) | Minimální hloubka, travel gas, proč se nezanáší na bottom mix | 4 |

Další zdroje pro rozšíření sady: výroční zprávy DAN o nehodách, NSS-CDS a NACD zprávy o jeskynních nehodách, BSAC Incident Report. Nehody na CCR (např. Boesmansgat 2005) se zatím neuvádějí, ale datový model je musí umožnit přidat s příznakem `ccr`.

### Zajímavosti „ze skutečnosti“ (kratší formát)

Krátké karty (2–4 věty + obrázek) u každé lekce: historie (Haldane a kozí pokusy, Hans Hass, vznik trimixu v rekreačním potápění), rekordy a průzkumy jeskyní, výzkum (NEDU deep stops, hustota plynu), české a evropské lokality (Hranická propast, Ojo Guareña, Lot).

## Kvízy, trénink a testy

Ověřování znalostí je hlavní funkce aplikace, ne doplněk: uživatel má být schopen kdykoliv za 2 minuty zjistit, jak na tom je, a za 10 minut cíleně potrénovat slabinu.

### Typy otázek

- Výběr jedné/více odpovědí; každá špatná možnost má vlastní vysvětlení, proč je špatně.
- **Numerická** – parametrizovaná šablona s náhodnými vstupy (hloubka, směs, SAC), výsledek počítá `calc/`, tolerance je součástí otázky.
- **Proč / co kdyby** – výběr příčiny nebo důsledku, ověřuje vazby grafu.
- **Seřaď** – postup (valve drill, přepnutí plynu, reakce na ztrátu lana).
- **Přiřaď** – příznak ↔ příčina (DCS, AGE, CO2, narkoza, hypoxie).
- **Najdi chybu** – v plánu ponoru nebo v záznamu postupu.
- **Obrázková/diagramová** – označ na ternárním diagramu, na profilu nebo na mapě jeskyně.
- **Scénář** – větvená situace s několika rozhodnutími.

### Režimy

| Režim | Účel | Délka |
| --- | --- | --- |
| Denní opakování | Rozložené opakování (FSRS) přes všechny odemknuté karty | 5–15 min |
| Z hlavy na čas | Mentální výpočty (MOD, END, ppO2, optimální trimix, hustota) s rostoucí obtížností, tipy na odhady a zaokrouhlování, statistika rychlosti a přesnosti | 3–10 min |
| Trénink tématu | Otázky z vybraného modulu nebo uzlu grafu | volitelná |
| Slabiny | Automaticky vybrané nejslabší uzly | 10 min |
| Zkouška modulu | Simulace teoretické zkoušky (40–60 otázek, limit času, práh 80 %) | 45–60 min |
| Rychlý check | 10 náhodných otázek napříč vším, skóre a mapa slabin | 2 min |

### Měření zvládnutí

- Každá otázka je navázaná na 1–3 uzly grafu; zvládnutí uzlu = vážený průměr úspěšnosti s časovým útlumem.
- Dashboard: mapa grafu obarvená podle zvládnutí, trend skóre, rychlost mentálních výpočtů v čase, série dní.
- Banka otázek: minimálně 40 otázek na modul pro MVP, cíl 150+; numerické šablony generují nekonečně variant.

## Média: text, obrázky, video a zvuk v češtině

Veškerý obsah je v češtině; odborné termíny mají při prvním výskytu anglický ekvivalent („hustota plynu (gas density)“) a vlastní heslo ve slovníčku.

| Médium | Jak vznikne | Poznámky |
| --- | --- | --- |
| Text | MDX lekce psané Fable podle šablony | Čitelnost: krátké odstavce, výrazné vzorce (KaTeX) |
| Diagramy | SVG/React komponenty generované kódem | Preferované před bitmapami: ostré, tmavý režim, interaktivní |
| Ilustrace | Vlastní SVG ilustrace (vybavení, anatomie, jeskynní navigace) | Bez fotografií s licencemi třetích stran; veřejné zdroje jen s ověřenou licencí (CC BY, public domain) a uvedením autora |
| Animace | Lottie nebo kódové animace (Framer Motion, Canvas) | Např. bublina při výstupu, kyslíkové okno, sycení tkání |
| Video | Krátká vysvětlovací videa 1–3 min renderovaná z animací (Remotion) + český hlas | Odkazy na externí videa jen jako volitelné „podívej se dál“ |
| Zvuk | Pre-generované české TTS shrnutí lekcí (např. ElevenLabs, Azure Neural TTS cs-CZ) uložené jako soubory | Režim „podcast“ pro poslech v autě; titulky a přepis; fallback Web Speech API offline |

**Výslovnost:** slovník výslovnosti pro TTS (zkratky jako MOD, END, ppO2, GF, SAC se čtou jako „em-ó-dé“, „pé-pé-ó-dva“ apod.), aby hlas nekomolil odbornou terminologii.

**Offline:** média jsou v balíčcích po modulech; uživatel si vybere, které stáhnout. Text, kvízy a kalkulačky jsou offline vždy.

## Technická architektura PWA

Statická offline-first PWA bez nutnosti backendu; veškerý pokrok uživatele žije v prohlížeči a lze ho exportovat. Synchronizace mezi zařízeními je volitelná pozdější etapa.

| Vrstva | Doporučená volba | Poznámka |
| --- | --- | --- |
| Framework | Vite + React + TypeScript (strict) | Fable může navrhnout alternativu v PLAN.md s odůvodněním |
| PWA | vite-plugin-pwa (Workbox), precache jádra, runtime cache médií | Instalovatelná na iOS i Android, update prompt |
| Obsah | MDX + JSON/YAML, validace schématem (Zod) při buildu | Chybný obsah zastaví build |
| Matematika | KaTeX | Vzorce v lekcích i v rozpisu výpočtu |
| Data uživatele | IndexedDB přes Dexie | Pokrok, odpovědi, plány opakování, nastavení |
| Opakování | ts-fsrs | Algoritmus FSRS |
| Graf | Cytoscape.js nebo d3-force | Musí být plynulý s 300+ uzly na mobilu |
| Grafy a vizualizace | visx/d3 | Profily, tkáně, ternární diagram |
| Stav | Zustand |  |
| Styl | Tailwind + vlastní design tokeny | Tmavý režim výchozí, velké dotykové plochy |
| Testy | Vitest (calc/, obsah), Playwright (klíčové toky, offline) | `calc/` 100% pokrytí větví |
| Hosting | Statický (Cloudflare Pages / GitHub Pages) | CI: lint, testy, validace obsahu, Lighthouse |

**Struktura repozitáře:**

```
/calc        čisté výpočty + testy (bez závislosti na UI)
/deco        Bühlmann ZHL-16C + GF, jen pro výuku
/content     moduly/, lekce (MDX), otázky, případovky, graf (JSON), slovník
/media       audio, obrázky, videa po modulech
/src         aplikace (routes, komponenty, simulátory, store)
/scripts     validace obsahu, generování TTS, kontrola odkazů grafu
```

**Nefunkční požadavky:** Lighthouse PWA a Accessibility ≥ 90; první načtení jádra < 1,5 MB bez médií; kompletní funkčnost offline; ovládání jednou rukou na telefonu; export/import pokroku do JSON; žádná telemetrie bez souhlasu.

## Datový model obsahu

Obsah je oddělený od kódu a všechny entity se odkazují přes stabilní `id`. Pole `branch` a `rig` umožní později přidat CCR bez změny schématu.

| Entita | Klíčová pole |
| --- | --- |
| Module | id, title, branch (`depth` / `cave` / `cross`), rig (`oc` / `ccr`), prerequisites[], order, passThreshold |
| Lesson | id, moduleId, title, sections podle šablony (hook, principle, formula, worked, playground, links, realWorld, check, audioSummary), conceptIds[], estimatedMinutes, sources[], needs_review |
| Concept (uzel grafu) | id, label, type, shortDefinition, lessonIds[], formulaId? |
| Relation (hrana grafu) | from, to, type, explanation, lessonId |
| Formula | id, latex, variables[] s jednotkami, calcFunction (název funkce v `calc/`) |
| Question | id, type, conceptIds[], difficulty 1–5, prompt, options[] s vysvětlením, answer nebo template + tolerance, explanation, sources[] |
| CaseStudy | id, title, year, location, rig, profile[] (čas, hloubka), timeline[], errorChain[] (vrstva, popis, conceptIds), physiology, calcTasks[], preventions[], sources[], certainty (`doloženo` / `hypotéza`), needs_review |
| Fact (zajímavost) | id, text, image?, conceptIds[], source |
| GlossaryTerm | cs, en, definition, pronunciation (pro TTS) |
| Media | id, kind, file, caption, credit, license |

Data uživatele (IndexedDB): `progress` (lekce, stav), `answers` (questionId, čas, správnost, trvání), `cards` (stav FSRS), `mastery` (conceptId, skóre), `settings`.

## Odborná přesnost a bezpečnost

Chyba ve výukové aplikaci o technickém potápění může někoho zabít, proto má přesnost přednost před rozsahem obsahu.

- **Jeden zdroj pravdy pro výpočty:** všechny otázky, kalkulačky i simulátory volá stejné funkce v `calc/`. Žádné číslo v textu lekce není napsáno ručně, pokud jde spočítat; MDX ho vloží voláním funkce.
- **Referenční testy:** tabulka referenčních hodnot (sekce Simulátory) plus každý výpočet ze řešených příkladů v lekcích se automaticky přepisuje na test.
- **Deko algoritmus:** ZHL-16C s GF ověřený proti veřejné referenční implementaci (např. Subsurface) na sadě 10 profilů; odchylka zastávek max. 1 min. Přesto jen pro výuku.
- **Zdroje:** učebnice agentur (TDI, IANTD, GUE), DAN, NOAA Diving Manual, US Navy Diving Manual, Bühlmann, Exley, recenzované články (Diving and Hyperbaric Medicine, Undersea & Hyperbaric Medicine). Každá lekce má seznam zdrojů.
- **Sporná témata** (hluboké zastávky, narkotičnost kyslíku, limity hustoty, konzervativnost GF) se prezentují jako debata s argumenty stran, ne jako jedna pravda.
- **Lidská kontrola:** obsah s `needs_review: true` má v aplikaci viditelný štítek „čeká na odbornou kontrolu“. Fable vygeneruje `REVIEW.md` se seznamem všech takových míst.
- **Disclaimery:** onboarding (nutné potvrdit), každá kalkulačka, deko simulátor, případové studie. Text: aplikace nenahrazuje kurz, instruktora ani plánovač ponorů; výpočty jsou ilustrativní.
- **Nahlášení chyby:** tlačítko u každé lekce a otázky uloží záznam lokálně a umožní jeho export.

## Etapy dodávky a akceptační kritéria

Dodávka je rozdělená do 6 etap; po každé se Fable zastaví a čeká na schválení. První použitelná verze vznikne po etapě 3.

| Etapa | Obsah | Hotovo, když |
| --- | --- | --- |
| 0 Plán | PLAN.md: architektura, schémata, seznam lekcí a uzlů grafu pro modul 0–1 | Schváleno uživatelem |
| 1 Jádro | Kostra PWA, offline, `calc/` kompletně s testy, schémata obsahu s validací, export/import pokroku | Testy zelené, aplikace se nainstaluje a funguje offline |
| 2 První modul | Moduly 0 a 1 (Základy, Advanced Nitrox) kompletně: lekce, kalkulačky, 40+ otázek, 2 případovky, graf | Lekce procházejí šablonou, otázky validní, žádný ručně psaný výsledek |
| 3 Trénink | FSRS opakování, režim Z hlavy na čas, zkouška modulu, dashboard zvládnutí, globální graf | MVP použitelné denně |
| 4 Hloubka | Moduly 2–4, tkáňový simulátor, ternární diagram, profil ponoru, další případovky | Deko ověřené proti referenci, REVIEW.md aktualizovaný |
| 5 Jeskyně | Moduly C1–C3, navigační mapa, scénáře v nulové viditelnosti | Scénáře hratelné jednou rukou na telefonu |
| 6 Média | České TTS shrnutí, režim podcast, animace a videa, balíčky médií ke stažení | Audio u každé lekce, výslovnost zkratek správně |

### Akceptační kritéria celé aplikace

- [ ] Každý vzorec má funkci v `calc/` a test s referenční hodnotou.
- [ ] Každá lekce má všech 9 částí šablony a alespoň 2 vazby do grafu.
- [ ] Každý uzel grafu má alespoň 1 lekci a 3 otázky.
- [ ] Každá případová studie má zdroje a označení jistoty.
- [ ] Aplikace funguje v režimu letadlo po instalaci.
- [ ] Rychlý check (10 otázek) je dostupný do 2 klepnutí z úvodní obrazovky.
- [ ] REVIEW.md obsahuje všechna místa k odborné kontrole.
