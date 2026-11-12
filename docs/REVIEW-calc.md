# Konvence ve výpočtech k odborné kontrole

Balíček `calc/` je pokrytý testy proti ručně spočteným hodnotám. Testy ale ověřují jen to, že kód
dělá, co jsem zamýšlel. Níže jsou místa, kde jsem musel zvolit konvenci – ta potřebují oko instruktora.

| # | Kde | Zvolená konvence | Proč kontrolovat |
| --- | --- | --- | --- |
| 1 | `density.ts` | Koeficienty 1,429 / 1,251 / 0,179 g/l (0 °C, 1 bar) dle SPEC; vzduch 21/79 ve 30 m = 5,15 g/l | Reálný vzduch s argonem dává 5,17 g/l. Rozhodnuto 2026-11-12: držet vzorec, rozdíl vysvětlit v lekci. |
| 2 | `oxygen.ts` `cnsLimitMinutes` | Tabulka NOAA 0,6–1,6 bar, lineární interpolace; ≤ 0,5 bar se nepočítá; 0,5–0,6 bar platí limit 720 min; nad 1,6 bar „mimo tabulku“ bez extrapolace | Hodnoty tabulky ověřit proti NOAA Diving Manual. Pásmo 0,5–0,6 a chování nad 1,6 jsou moje volby. |
| 3 | `oxygen.ts` `REPEX_DAILY_OTU` | 850, 700, 620, 525, 460, 420, 380, 350, 330, 310, pak 300 OTU/den | Čísla psaná z paměti podle Hamiltonovy metody REPEX – ověřit proti zdroji před použitím v lekci o OTU. |
| 4 | `consumption.ts` `rockBottom` | 2 potápěči, 1 min řešení v hloubce, výstup 9 m/min průměrnou hloubkou, zastávky volitelně | Agentury se liší (GUE minimum gas vs. TDI). Výchozí hodnoty jsou parametry; potvrdit, co má být výchozí. |
| 5 | `consumption.ts` `teamTurnPressure` | Otočka = nejpřísnější z: vlastní třetina každého, a rezerva každého musí vyvést oba od nejvzdálenějšího bodu | Model je odvozený, ne převzatý z učebnice. Pro stejné lahve dává klasické třetiny, pro různé lahve standardní přepočet objemu. |
| 6 | `consumption.ts` `ruleOfThirdsPractical` | Třetina zaokrouhlená dolů na 10 bar | Běžná praxe; potvrdit krok. |
| 7 | `icd.ts` | Pravidlo pětin: nárůst fN2 ≤ 1/5 poklesu fHe | Provozní konvence, v lekci prezentovat jako debatu (SPEC: sporná témata). |
| 8 | `trimix.ts` `practicalTrimix` | Kyslík dolů, helium nahoru na celá procenta | Potvrdit, zda má aplikace nabízet i „standardní směsi“ (např. GUE 18/45, 15/55). |
| 9 | `narcosis.ts` | EAD a END používají 0,79 jako frakci dusíku ve vzduchu; výchozí je O2 narkotický | Dle SPEC; UI vždy ukáže obě varianty END. |
| 11 | `physics.ts` `adiabaticTempC` | Ideální adiabata, κ = 1,4 | Horní mez; v lekci výslovně uvedeno. |
| 12 | `physics.ts` `netBuoyancyKg` | Hustota mořské vody 1,03 kg/l | Běžná zaokrouhlená hodnota. |
| 13 | `mdx/playgrounds.tsx` | Kyslíkové okno a pohlcování barev: ilustrativní hodnoty, ne výpočet | Čísla (mmHg, hloubky mizení barev) ověřit proti učebnici fyziologie. |
| 14 | `deco/plan.ts` | GF low ukotvený na hloubce první zastávky; zastávky v celých minutách; přepnutí plynu po příchodu na zastávku; výchozí výstup 9 m/min | Subsurface kotví GF low na nejhlubším stropu, ne na zaokrouhlené zastávce – u GF < 100 se plány mohou lišit o minuty. Ověřeno jen pro GF 100/100. |
| 15 | `deco/model.ts` | Výuková konvence 10 m = 1 bar, hladina 1 bar, vodní pára 0,0627 bar, vzduch 79 % N2 | Čísla v lekcích se proto mírně liší od počítače s 1,013 bar a slanou vodou. |
| 16 | `deco/simple.ts` `ndlMinutes` | GF low = GF high, celé minuty, čas na dně včetně sestupu 20 m/min | Limity v lekcích jsou „podle výukového modelu“, ne tabulkové hodnoty. |
| 17 | `mdx/WhatIfGraph.tsx` | Stupně uzlů: ppO2 1,4 / 1,6 bar, END 30 / 40 m, hustota 5,2 / 6,2 g/l; námaha posune CO2 o stupeň, vysoký CO2 posune narkózu o stupeň | Prahy a pravidla posunu jsou výukové zjednodušení, ne fyziologický model. |
| 18 | `trimix.ts` `minHeForEnd`, `optimalTrimixSteps` | Kyslík se počítá jako narkotický | Opatrnější varianta; kalkulačka END ukazuje obě. |
| 19 | `deco/analyze.ts` | CNS a OTU se počítají průměrným ppO2 mezi minutovými vzorky; limit ppO2 1,4 bar pro dno směs a 1,6 bar pro ostatní plyny; CNS nad 80 % je výhrada | Hrubší než výpočet počítače; při přepnutí plynu se krátký úsek do zátěže nezapočítá. |
| 20 | `deco/plan.ts` víceúrovňový profil | Přesun mezi úrovněmi se neřídí stropem; porušení ohlásí rozbor | Záměrně – simulátor má ukázat, že takový profil je chybný. |
| 21 | `icd.ts` | Pravidlo pětin počítané z frakcí, bez ohledu na hloubku přepnutí | Porušují ho i běžná přepnutí mezi standardními směsmi; prezentováno jako konvence. |
| 10 | `blending.ts` | Ideální plyn | Trimix při 200+ bar se od ideálního plynu liší znatelně; van der Waals přijde s modulem 3. |
