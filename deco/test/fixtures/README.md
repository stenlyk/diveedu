# Referenční profily pro ověření `deco/`

SPEC požaduje ověření proti veřejné referenční implementaci na sadě 10 profilů s odchylkou zastávek nejvýš 1 minutu.

**Stav k 2026-11-12:** 1 profil z 10.

- Koeficienty ZHL-16C jsou ověřené proti zdrojovému kódu Subsurface (`core/deco.cpp`).
- Profil `testMetric` z testů Subsurface (`tests/testplan.cpp`) vychází na 109,0 min proti očekávaným 109 min.
- Zbývá 9 profilů. Automatické vygenerování referenčních hodnot vyžaduje spustit cizí kód (např. Python knihovnu),
  což při vývoji nebylo povoleno. Hodnoty lze doplnit ručně z plánovače Subsurface.

## Jak přidat profil

1. V Subsurface otevři plánovač, nastav algoritmus Bühlmann a stejné parametry jako ve vstupu
   (GF, rychlosti, poslední zastávka 6 m nebo 3 m, slaná voda, 1 atm / 1013 mbar).
2. Do `reference-profiles.json` přidej záznam se vstupem a očekávanými hodnotami:
   - `expected.runtimeMin` – celkový čas ponoru,
   - volitelně `expected.stops` – pole `{ "depthM": 9, "minutes": 12 }`.
3. Spusť `npm test`. Test `deco/test/reference.test.ts` porovná každý profil s tolerancí 1 minuta
   na zastávku a 1 minuta na celkový čas na každých započatých 60 minut ponoru.

Doporučená sada: vzduch 30 m / 40 min; vzduch 45 m / 25 min; EAN32 36 m / 40 min; vzduch 45 m / 25 min + EAN50;
vzduch 51 m / 20 min + EAN50 + O2; Tx 21/35 51 m / 25 min + EAN50; Tx 18/45 60 m / 25 min + EAN50 + O2;
Tx 15/55 75 m / 20 min + EAN36 + O2; totéž s GF 30/85 a 50/80.
