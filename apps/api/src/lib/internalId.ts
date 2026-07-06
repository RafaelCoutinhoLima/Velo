import type { supabase as defaultSupabase } from '../db/client';

type Db = Pick<typeof defaultSupabase, 'from'>;

// Cache do mapeamento user_id (JWT) → athletes.id. O par nasce no onboarding e
// só morre na exclusão da conta (invalidateInternalId), então dá pra cachear
// sem TTL — economiza 1 round-trip ao Supabase em praticamente toda rota
// autenticada. Só resultados POSITIVOS entram no cache: um null (atleta ainda
// não criou perfil) precisa ser re-consultado no request seguinte.
//
// Chaveado por instância de db (WeakMap): produção usa o client singleton
// (cache efetivo entre requests); cada teste injeta seu próprio mock, então o
// isolamento entre testes vem de graça.
const cacheByDb = new WeakMap<object, Map<string, string>>();

export async function resolveInternalId(db: Db, userId: string): Promise<string | null> {
  const cached = cacheByDb.get(db)?.get(userId);
  if (cached) return cached;

  const { data } = await db.from('athletes').select('id').eq('user_id', userId).single();
  const id = (data as { id: string } | null)?.id ?? null;
  if (id) {
    let byUser = cacheByDb.get(db);
    if (!byUser) {
      byUser = new Map();
      cacheByDb.set(db, byUser);
    }
    byUser.set(userId, id);
  }
  return id;
}

// Chamar após excluir a conta (DELETE /athlete) — o mapeamento morreu.
export function invalidateInternalId(db: Db, userId: string): void {
  cacheByDb.get(db)?.delete(userId);
}
