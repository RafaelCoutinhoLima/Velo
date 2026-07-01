import { describe, expect, it } from 'bun:test';
import { loadPrincipios, PRINCIPIOS, PRINCIPIOS_LOADED } from './principios';

describe('principios_treino.md — base científica do prompt', () => {
  // Guarda de build: se o path relativo quebrar (ex.: Docker com layout diferente),
  // o Claude gera planos sem base científica. Este teste falha ANTES do deploy.
  it('carrega o arquivo real no ambiente de build', () => {
    expect(PRINCIPIOS_LOADED).toBe(true);
  });

  it('conteúdo tem substância e não é o texto de fallback', () => {
    expect(PRINCIPIOS.length).toBeGreaterThan(500);
    expect(PRINCIPIOS).not.toContain('não encontrado');
    // Marcador estável da base — se sumir, o arquivo foi corrompido/trocado.
    expect(PRINCIPIOS).toContain('ACWR');
  });

  it('loadPrincipios com path inexistente retorna loaded:false sem lançar', () => {
    const r = loadPrincipios('/caminho/que/nao/existe.md');
    expect(r.loaded).toBe(false);
    expect(r.content).toContain('não encontrado');
  });
});
