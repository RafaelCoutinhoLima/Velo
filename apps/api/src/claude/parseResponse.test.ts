import { describe, expect, it } from 'bun:test';
import { extractJsonObject, extractJsonWithFallback } from './parseResponse';

describe('extractJsonObject — parsing por balanceamento de chaves', () => {
  it('ignora ruído com chaves antes do objeto válido', () => {
    const raw = 'blá { ruído } blá {"weeks":[],"summary":"x"}';
    expect(extractJsonObject(raw)).toBe('{"weeks":[],"summary":"x"}');
  });

  it('caso adversarial: chaves não-JSON antes do objeto real', () => {
    const raw = 'texto { não é json } mais texto {"real": true}';
    expect(extractJsonObject(raw)).toBe('{"real": true}');
  });

  it('JSON em bloco markdown continua funcionando (não-regressão)', () => {
    const raw = '```json\n{"weeks":[1],"summary":"ok"}\n```';
    expect(extractJsonObject(raw)).toBe('{"weeks":[1],"summary":"ok"}');
  });

  it('ignora chaves dentro de strings JSON', () => {
    const raw = '{"summary":"tem } chave } solta dentro","ok":true}';
    expect(extractJsonObject(raw)).toBe('{"summary":"tem } chave } solta dentro","ok":true}');
  });

  it('lança quando não há objeto JSON válido', () => {
    expect(() => extractJsonObject('sem json aqui { nem } isso')).toThrow();
  });

  it('extractJsonWithFallback devolve o objeto válido', () => {
    expect(extractJsonWithFallback('ruído {"a":1} fim')).toBe('{"a":1}');
  });
});
