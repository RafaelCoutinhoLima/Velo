import { Elysia } from 'elysia';
import { supabase } from '../db/client';

// Recebe o token bruto (sem "Bearer ") e devolve o user id (auth.uid) do
// Supabase, ou null se o token for ausente/inválido/expirado.
export type TokenVerifier = (token: string | undefined) => Promise<string | null>;

// Verificador real: valida o JWT server-side no Supabase Auth (assinatura ES256
// + expiração) e extrai o user id. Injetável para testes via authGuard(verify).
export const verifySupabaseToken: TokenVerifier = async (token) => {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
};

// Extrai o token do header "Authorization: Bearer <token>".
export function bearer(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1] : undefined;
}

// Plugin Elysia que resolve `userId` a partir do header Authorization e
// responde 401 quando o token está ausente ou é inválido. Aplicado por rota
// via `.use(authGuard())`; as rotas então usam `userId` (o dono autenticado)
// em vez de confiar em athlete_id vindo do corpo/query (fix IDOR/BOLA).
//
// Sem `name` de propósito: um nome faria o Elysia deduplicar o plugin entre
// instâncias e vazar/omitir o resolve. `as: 'scoped'` propaga o resolve para
// a instância que deu .use() (a rota) e suas sub-rotas — e só até lá.
export function authGuard(verify: TokenVerifier = verifySupabaseToken) {
  return new Elysia().resolve({ as: 'scoped' }, async ({ headers, status }) => {
    const userId = await verify(bearer(headers.authorization));
    if (!userId) return status(401, { error: 'Não autenticado' });
    return { userId };
  });
}
