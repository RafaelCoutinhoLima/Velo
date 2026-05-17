import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { evaluateCalibration } from './calibration';

const DATE_AGO = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const ISO_AGO = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type MockOpts = {
  athleteRow?: { calibration_mode?: boolean; created_at?: string } | null;
  workouts?: { date: string }[];
  pushToken?: string | null;
};

function makeDb(opts: MockOpts = {}) {
  const { athleteRow = null, workouts = [], pushToken = null } = opts;
  const calls = { update: 0 };
  const db = {
    _calls: calls,
    from(table: string) {
      if (table === 'athletes') {
        return {
          select: (cols: string) => ({
            eq: () => ({
              single: async () =>
                cols.includes('push_token')
                  ? { data: { push_token: pushToken }, error: null }
                  : { data: athleteRow, error: athleteRow ? null : { message: 'not found' } },
            }),
          }),
          update: () => ({
            eq: async () => {
              calls.update++;
              return { error: null };
            },
          }),
        };
      }
      // workouts
      return {
        select: () => ({
          eq: async () => ({ data: workouts, error: null }),
        }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return db;
}

type Db = Parameters<typeof evaluateCalibration>[0];

beforeEach(() => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(
    async () => new Response('{}', { status: 200 }),
  );
});

describe('evaluateCalibration', () => {
  it('idempotente: já fora de calibração → no-op', async () => {
    const db = makeDb();
    const r = await evaluateCalibration(db as unknown as Db, 'a1', {
      athleteRow: { calibration_mode: false, created_at: ISO_AGO(40) },
    });
    expect(r).toEqual({ calibrationMode: false, justExited: false });
    expect(db._calls.update).toBe(0);
  });

  it('sem created_at e sem treinos → segue em calibração', async () => {
    const db = makeDb({ athleteRow: {} });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r).toEqual({ calibrationMode: true, justExited: false });
  });

  it('conta nova + <30 dias distintos → segue em calibração', async () => {
    const db = makeDb({
      athleteRow: { calibration_mode: true, created_at: ISO_AGO(20) },
      workouts: [{ date: DATE_AGO(3) }, { date: DATE_AGO(2) }],
    });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r.calibrationMode).toBe(true);
    expect(r.justExited).toBe(false);
  });

  it('histórico antigo + ≥30 dias distintos → sai (justExited) e envia push', async () => {
    const workouts = Array.from({ length: 35 }, (_, i) => ({ date: DATE_AGO(50 - i) }));
    const db = makeDb({
      athleteRow: { calibration_mode: true, created_at: ISO_AGO(5) },
      workouts,
      pushToken: 'ExponentPushToken[abc]',
    });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r).toEqual({ calibrationMode: false, justExited: true });
    expect(db._calls.update).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('sai mesmo sem push_token (sendExpoPush não lança)', async () => {
    const workouts = Array.from({ length: 32 }, (_, i) => ({ date: DATE_AGO(40 - i) }));
    const db = makeDb({
      athleteRow: { calibration_mode: true, created_at: ISO_AGO(60) },
      workouts,
      pushToken: null,
    });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r.justExited).toBe(true);
    expect(db._calls.update).toBe(1);
  });

  it('busca athleteRow do banco quando não passado', async () => {
    const db = makeDb({
      athleteRow: { calibration_mode: true, created_at: ISO_AGO(2) },
      workouts: [{ date: DATE_AGO(1) }],
    });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r.calibrationMode).toBe(true);
  });

  it('usa distinctWorkoutDays/earliestWorkoutDate do caller (sem query extra)', async () => {
    const db = makeDb({ athleteRow: { calibration_mode: true, created_at: ISO_AGO(3) } });
    const r = await evaluateCalibration(db as unknown as Db, 'a1', {
      athleteRow: { calibration_mode: true, created_at: ISO_AGO(3) },
      distinctWorkoutDays: 30,
      earliestWorkoutDate: DATE_AGO(40),
    });
    expect(r).toEqual({ calibrationMode: false, justExited: true });
  });

  it('earliestIso: só histórico (created_at ausente) define a janela', async () => {
    const workouts = Array.from({ length: 31 }, (_, i) => ({ date: DATE_AGO(45 - i) }));
    const db = makeDb({ athleteRow: { calibration_mode: true }, workouts });
    const r = await evaluateCalibration(db as unknown as Db, 'a1');
    expect(r.justExited).toBe(true);
  });
});
