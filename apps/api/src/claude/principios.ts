import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../lib/logger';

// Base científica injetada no system prompt do Claude (CLAUDE.md §5.7). Este módulo vive
// em apps/api/src/claude/, então ../../../../docs resolve para <repo>/docs corretamente.
// (Os prompts em prompts/ ficam um nível mais fundo — por isso o loader é centralizado aqui.)
const PRINCIPIOS_PATH = resolve(import.meta.dir, '../../../../docs/principios_treino.md');

const FALLBACK =
  '(principios_treino.md não encontrado — usar conhecimento geral de fisiologia do esporte)';

export interface PrincipiosLoad {
  content: string;
  loaded: boolean;
}

// Lê a base científica do disco. Nunca lança: em falha retorna { loaded:false } com o
// texto de fallback, para o chamador poder alarmar em vez de degradar em silêncio.
export function loadPrincipios(path: string = PRINCIPIOS_PATH): PrincipiosLoad {
  try {
    const content = readFileSync(path, 'utf-8').trim();
    if (content.length === 0) return { content: FALLBACK, loaded: false };
    return { content, loaded: true };
  } catch {
    return { content: FALLBACK, loaded: false };
  }
}

const result = loadPrincipios();

if (!result.loaded) {
  // A base científica é o núcleo da prescrição. Sem ela o Claude gera planos com
  // conhecimento genérico — degradação crítica que antes passava despercebida.
  // Alarme alto no startup para build/deploy não mascarar um path quebrado.
  logger.error(
    { path: PRINCIPIOS_PATH },
    'CRÍTICO: principios_treino.md não carregado — planos serão gerados SEM base científica',
  );
}

export const PRINCIPIOS = result.content;
export const PRINCIPIOS_LOADED = result.loaded;
export { PRINCIPIOS_PATH };
