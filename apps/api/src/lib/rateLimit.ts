// Rate limiter fixed-window em memória, chaveado por string (userId).
//
// Deliberadamente simples pra Fase 1 (instância única no Railway, ~2 atletas
// em dogfooding): sem Redis (antipadrão CLAUDE.md §9 — peça de Fase 2), sem
// sliding window. Se a API virar multi-instância, o limite passa a valer por
// instância — aceitável para o que ele protege hoje (abuso/bruteforce, não
// cota de negócio; a cota mensal do Claude já é atômica no Postgres).
//
// Cada plugin cria o seu via createRateLimiter(): produção usa o singleton do
// módulo de rota (estado efetivo entre requests) e cada teste cria um plugin
// novo, então o isolamento entre testes vem de graça.
export type RateLimiter = { consume(key: string): boolean };

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    // true = requisição permitida; false = estourou o limite na janela atual.
    consume(key: string): boolean {
      const now = Date.now();
      const win = windows.get(key);

      if (!win || now >= win.resetAt) {
        // Varredura oportunista só quando o mapa cresce demais — evita que
        // chaves de janelas mortas acumulem memória indefinidamente.
        if (windows.size >= MAX_TRACKED_KEYS) {
          for (const [k, v] of windows) {
            if (now >= v.resetAt) windows.delete(k);
          }
        }
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      win.count += 1;
      return win.count <= max;
    },
  };
}
