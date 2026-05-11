import { describe, expect, it } from 'vitest';
import { calculateRTSS } from '../src/rtss';

describe('calculateRTSS', () => {
  const FTP = 330; // 5:30/km em segundos

  it('retorna 0 para treino com duração zero', () => {
    expect(
      calculateRTSS(
        { date: '2026-01-01', distance_m: 5000, duration_s: 0, avg_hr: 150, max_hr: 170 },
        FTP,
      ),
    ).toBe(0);
  });

  it('retorna 0 para treino com distância zero', () => {
    expect(
      calculateRTSS(
        { date: '2026-01-01', distance_m: 0, duration_s: 1800, avg_hr: 150, max_hr: 170 },
        FTP,
      ),
    ).toBe(0);
  });

  it('calcula rTSS para treino fácil de 5km em 30min', () => {
    // Pace 6:00/km (360s), FTP 5:30/km (330s) → IF < 1 → TSS < 50
    const result = calculateRTSS(
      { date: '2026-01-01', distance_m: 5000, duration_s: 1800, avg_hr: 140, max_hr: 160 },
      FTP,
    );
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(50);
  });

  it('calcula rTSS maior para treino mais longo', () => {
    const short = calculateRTSS(
      { date: '2026-01-01', distance_m: 5000, duration_s: 1800, avg_hr: 140, max_hr: 160 },
      FTP,
    );
    const long = calculateRTSS(
      { date: '2026-01-01', distance_m: 15000, duration_s: 5400, avg_hr: 140, max_hr: 160 },
      FTP,
    );
    expect(long).toBeGreaterThan(short);
  });

  it('resultado é sempre não negativo', () => {
    const result = calculateRTSS(
      { date: '2026-01-01', distance_m: 1000, duration_s: 600, avg_hr: 120, max_hr: 140 },
      FTP,
    );
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
