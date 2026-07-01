// Extrai o objeto JSON da resposta do Claude por balanceamento de chaves, ignorando
// chaves dentro de strings/escapes. Substitui o regex greedy /\{[\s\S]*\}/ que casava
// da primeira à última chave do texto inteiro (quebrava com qualquer chave ao redor).

// Retorna todos os blocos {...} balanceados de nível superior, na ordem em que aparecem.
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return out;
}

// Retorna a substring do primeiro bloco balanceado que faz JSON.parse com sucesso.
// Assim, ruído com chaves antes do bloco real (ex.: "texto { nota } {\"real\":true}")
// é descartado em favor do objeto válido. Lança se nenhum bloco parsear.
export function extractJsonObject(text: string): string {
  const candidates = balancedObjects(text);
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // bloco balanceado mas não é JSON válido — tenta o próximo
    }
  }
  throw new Error('Nenhum objeto JSON válido encontrado na resposta');
}

// Defensivo (generation_spec): tenta o helper robusto; se falhar, cai no regex antigo
// antes de lançar, para não regredir em casos que o regex ainda resolveria.
export function extractJsonWithFallback(text: string): string {
  try {
    return extractJsonObject(text);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    throw err;
  }
}
