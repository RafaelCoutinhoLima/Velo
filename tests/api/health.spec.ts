import { expect, test } from '@playwright/test';

test.describe('Health', () => {
  test('GET /health retorna status ok', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.ts).toBe('string');
  });

  test('garmin sidecar health', async ({ request }) => {
    const sidecarUrl = process.env.SIDECAR_URL ?? 'http://localhost:8000';
    const res = await request.get(`${sidecarUrl}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
});
