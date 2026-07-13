import { describe, expect, it } from 'bun:test';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('permite até max requisições na janela e bloqueia a seguinte', () => {
    const limiter = createRateLimiter(3, 60_000);
    expect(limiter.consume('user-a')).toBe(true);
    expect(limiter.consume('user-a')).toBe(true);
    expect(limiter.consume('user-a')).toBe(true);
    expect(limiter.consume('user-a')).toBe(false);
    expect(limiter.consume('user-a')).toBe(false);
  });

  it('chaves diferentes têm janelas independentes', () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.consume('user-a')).toBe(true);
    expect(limiter.consume('user-a')).toBe(false);
    expect(limiter.consume('user-b')).toBe(true);
  });

  it('libera de novo quando a janela expira', async () => {
    const limiter = createRateLimiter(1, 20);
    expect(limiter.consume('user-a')).toBe(true);
    expect(limiter.consume('user-a')).toBe(false);
    await Bun.sleep(25);
    expect(limiter.consume('user-a')).toBe(true);
  });

  it('instâncias separadas não compartilham estado', () => {
    const l1 = createRateLimiter(1, 60_000);
    const l2 = createRateLimiter(1, 60_000);
    expect(l1.consume('user-a')).toBe(true);
    expect(l2.consume('user-a')).toBe(true);
  });
});
