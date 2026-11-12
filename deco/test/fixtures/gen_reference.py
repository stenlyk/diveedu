"""Vygeneruje referenční dekompresní rozvrhy knihovnou decotengu (ZH-L16C s gradient factors).

Spouští se ručně, mimo testy, ve vlastním virtuálním prostředí:

    python3 -m venv .venv-ref
    .venv-ref/bin/pip install decotengu
    .venv-ref/bin/python deco/test/fixtures/gen_reference.py

Výstup zapíše do deco/test/fixtures/reference-decotengu.json. Soubor reference-profiles.json nemění;
hodnoty se do něj přenášejí až po kontrole, že vstupy obou implementací znamenají totéž
(čas na dně včetně sestupu, rychlosti, poslední zastávka, tlak na hladině).
"""
import json
import os
import sys
import traceback

import decotengu

# (název, hloubka m, čas na dně min včetně sestupu, plyny [(hloubka přepnutí, O2 %, He %)], GF low, GF high, poslední zastávka 6 m)
PROFILES = [
    ('vzduch 30 m / 40 min, GF 30/85', 30, 40, [(0, 21, 0)], 30, 85, False),
    ('vzduch 45 m / 25 min, GF 30/85', 45, 25, [(0, 21, 0)], 30, 85, False),
    ('EAN32 36 m / 40 min, GF 30/85', 36, 40, [(0, 32, 0)], 30, 85, False),
    ('vzduch 45 m / 25 min + EAN50 od 21 m, GF 30/85', 45, 25, [(0, 21, 0), (21, 50, 0)], 30, 85, False),
    ('vzduch 51 m / 20 min + EAN50 od 21 m + O2 od 6 m, GF 30/85', 51, 20, [(0, 21, 0), (21, 50, 0), (6, 100, 0)], 30, 85, True),
    ('Tx 21/35 51 m / 25 min + EAN50 od 21 m, GF 30/85', 51, 25, [(0, 21, 35), (21, 50, 0)], 30, 85, False),
    ('Tx 18/45 60 m / 25 min + EAN50 od 21 m + O2 od 6 m, GF 30/85', 60, 25, [(0, 18, 45), (21, 50, 0), (6, 100, 0)], 30, 85, True),
    ('Tx 18/45 60 m / 25 min + EAN50 od 21 m, GF 50/80', 60, 25, [(0, 18, 45), (21, 50, 0)], 50, 80, False),
    ('Tx 15/55 75 m / 20 min + EAN36 od 33 m + O2 od 6 m, GF 30/85', 75, 20, [(0, 15, 55), (33, 36, 0), (6, 100, 0)], 30, 85, True),
    ('Tx 15/55 75 m / 20 min + EAN36 od 33 m + O2 od 6 m, GF 50/80', 75, 20, [(0, 15, 55), (33, 36, 0), (6, 100, 0)], 50, 80, True),
]


def settings(engine):
    """Nastavení enginu, která rozhodují o srovnatelnosti; co knihovna nemá, se vypíše jako None."""
    names = ['descent_rate', 'ascent_rate', 'surface_pressure', 'meter_to_bar', 'last_stop_6m', 'pp_o2', 'time_delta']
    out = {name: getattr(engine, name, None) for name in names}
    out['model'] = type(engine.model).__name__
    for name in ('gf_low', 'gf_high', 'water_vapour_pressure'):
        out[name] = getattr(engine.model, name, None)
    return out


def run(name, depth, time, gases, gf_low, gf_high, last_stop_6m):
    engine = decotengu.create()
    engine.model = decotengu.ZH_L16C_GF()
    engine.model.gf_low = gf_low / 100
    engine.model.gf_high = gf_high / 100
    engine.last_stop_6m = last_stop_6m
    for switch_depth, o2, he in gases:
        engine.add_gas(switch_depth, o2, he)
    steps = list(engine.calculate(depth, time))
    table = engine.deco_table
    stops = [{'depthM': round(float(stop.depth), 2), 'minutes': round(float(stop.time), 2)} for stop in table]
    last = steps[-1]
    return {
        'name': name,
        'input': {'depthM': depth, 'bottomMinutes': time, 'gases': gases, 'gfLow': gf_low, 'gfHigh': gf_high, 'lastStop6m': last_stop_6m},
        'settings': settings(engine),
        'stops': stops,
        'decoTotalMin': round(float(table.total), 2),
        'runtimeMin': round(float(getattr(last, 'time', float('nan'))), 2),
    }


def main():
    results, failures = [], []
    for profile in PROFILES:
        try:
            results.append(run(*profile))
        except Exception:  # knihovna může mít jiné API, než skript čeká; chybu chceme vidět celou
            failures.append({'name': profile[0], 'error': traceback.format_exc()})
    target = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reference-decotengu.json')
    with open(target, 'w', encoding='utf-8') as handle:
        json.dump({'library': 'decotengu', 'version': getattr(decotengu, '__version__', None), 'python': sys.version.split()[0], 'results': results, 'failures': failures}, handle, ensure_ascii=False, indent=1)
    print(f'{len(results)} profilů spočítáno, {len(failures)} selhalo → {target}')
    for failure in failures:
        print('---', failure['name'])
        print(failure['error'])


if __name__ == '__main__':
    main()
