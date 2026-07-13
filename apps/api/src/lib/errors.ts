// Erro de domínio com mensagem SEGURA para o usuário final.
//
// O onError global (index.ts) nunca expõe error.message de erros desconhecidos
// — mensagens cruas do Postgres/Garmin/stack viram reconhecimento pra atacante.
// Só que isso também engolia as mensagens CURADAS que as rotas escreviam de
// propósito ("Sua conexão Garmin expirou. Reconecte…"): em produção o atleta
// via sempre o genérico "Tive um problema técnico". AppError é o canal
// explícito: quem constrói um AppError garante que o texto pode ir ao cliente
// (sem interpolar erro interno). Todo o resto continua genérico.
//
// `status` é o HTTP devolvido; o Elysia também o respeita quando o erro chega
// ao handler default (sem onError), então testes de rota veem o mesmo código.
export class AppError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

type ErrorResponse = { status: number; body: { error: string } };

// Mapeia (code, error) do onError global para a resposta HTTP. Extraído do
// index.ts para ser testável sem subir o servidor (index.ts dá .listen no boot).
export function mapErrorResponse(code: unknown, error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message } };
  }
  if (code === 'VALIDATION') {
    return { status: 400, body: { error: 'Requisição inválida' } };
  }
  if (code === 'NOT_FOUND') {
    return { status: 404, body: { error: 'Recurso não encontrado' } };
  }
  return { status: 500, body: { error: 'Tive um problema técnico, já avisamos a equipe.' } };
}
