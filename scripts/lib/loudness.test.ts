import { describe, expect, it } from 'vitest';
import { LOUDNESS_TARGET, needsNormalization, parseLoudnormOutput } from './loudness';

const at = (integrated: number, truePeak = -3) => ({ integrated, truePeak, range: 5, threshold: -30 });

describe('normalizace hlasitosti', () => {
  it('soubor v cíli a s nízkou špičkou se nepřekódovává', () => {
    expect(needsNormalization(at(LOUDNESS_TARGET.integrated))).toBe(false);
    expect(needsNormalization(at(LOUDNESS_TARGET.integrated + 0.9))).toBe(false);
  });
  it('tichý nebo hlasitý soubor mimo toleranci se upraví', () => {
    expect(needsNormalization(at(-34.9))).toBe(true);
    expect(needsNormalization(at(-14.5))).toBe(true);
  });
  it('příliš vysoká špička se upraví i při správné hlasitosti', () => {
    expect(needsNormalization(at(-16, -0.5))).toBe(true);
  });
  it('přečte měření z výpisu ffmpeg', () => {
    const stderr = 'Input #0, mp3 ...\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-24.31",\n\t"input_tp" : "-6.20",\n\t"input_lra" : "4.10",\n\t"input_thresh" : "-34.60"\n}\n';
    expect(parseLoudnormOutput(stderr)).toEqual({ integrated: -24.31, truePeak: -6.2, range: 4.1, threshold: -34.6 });
  });
  it('neúplné měření (ticho) je chyba, ne nula', () => {
    expect(() => parseLoudnormOutput('{ "input_i" : "-inf", "input_tp" : "-inf", "input_lra" : "0", "input_thresh" : "-70" }')).toThrow(/není úplné/);
    expect(() => parseLoudnormOutput('nic')).toThrow(/nevrátil/);
  });
});
