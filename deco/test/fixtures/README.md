# Referenční profily pro ověření `deco/`

SPEC požaduje ověření proti veřejné referenční implementaci na sadě 10 profilů s odchylkou zastávek nejvýš 1 minutu.

**Stav k 2026-11-12:** 11 profilů, všechny v toleranci.

| Zdroj | Profily | Co se porovnává |
| --- | --- | --- |
| Subsurface, `tests/testplan.cpp` (`testMetric`) | 1 | celkový čas: 109,0 min proti 109 min, GF 100/100 |
| decotengu 0.14.1, model `ZH_L16C_GF` | 10 | každá zastávka (nejvýš 1 min) a celkový čas |

Koeficienty ZHL-16C jsou navíc ověřené proti zdrojovému kódu Subsurface (`core/deco.cpp`).

## Sada z decotengu

Vzduch, EAN32, vzduch s EAN50 a kyslíkem, trimix 21/35, 18/45 a 15/55 s jedním a dvěma dekompresními plyny; GF 30/85 a 50/80;
poslední zastávka ve 3 i 6 m. Vstupy a surový výstup knihovny jsou v `reference-decotengu.json`.

Výsledek: nejhorší odchylka jednotlivé zastávky je 1 minuta (z 81 porovnaných zastávek se jich 30 liší o minutu, žádná o víc).

**Celkový čas se liší až o 3 minuty** a tolerance je proto u těchto profilů nastavená výslovně (`runtimeToleranceMin: 3`).
Příčina je konvence, ne model: decotengu po zahájení dekomprese drží na každé třímetrové zastávce nejméně minutu,
kdežto náš plánovač (stejně jako Subsurface) zastávkou, jejíž strop je při příchodu už splněný, jen proplave.
Rozdíl celkového času se u každého profilu rovná součtu rozdílů po zastávkách.

Porovnání běží s konstantami knihovny: hladina 1,01325 bar, 0,09985 bar na metr, vodní pára 0,0627 bar,
sestup 20 m/min, výstup 10 m/min, bez zdržení při přepnutí plynu. Aplikace sama používá výukové konstanty (10 m = 1 bar).

## Co ověření neříká

- Obě implementace vycházejí ze stejných publikovaných koeficientů. Shoda dokládá, že je model naprogramovaný správně,
  ne že je správný model.
- GF low kotví decotengu i náš plánovač na hloubce první zastávky. Subsurface ho kotví jinak; proti němu je ověřen jen profil GF 100/100.
- Víceúrovňové profily a travel gas při sestupu v sadě nejsou.

## Jak sadu přegenerovat

```
python3 -m venv .venv-ref
.venv-ref/bin/pip install decotengu
.venv-ref/bin/python deco/test/fixtures/gen_reference.py
```

Skript přepíše jen `reference-decotengu.json`. Do `reference-profiles.json` se hodnoty přenášejí až po kontrole.

## Jak přidat profil ručně

Do `reference-profiles.json` přidej záznam se vstupem, volitelně `env`, a očekávanými hodnotami
(`expected.runtimeMin`, volitelně `expected.stops`). Test `deco/test/reference.test.ts` porovná každou zastávku s tolerancí 1 minuta
a celkový čas s tolerancí 1 minuta na každých započatých 60 minut, není-li uvedena `runtimeToleranceMin`.
