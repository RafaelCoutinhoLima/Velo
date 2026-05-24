#!/usr/bin/env bun
// Lê stdin da saída de `bun test --coverage`, parseia a linha "All files",
// e falha (exit 1) se line/function ficarem abaixo dos thresholds.
// Existe porque bun ignora `coverageThreshold` em bunfig.toml (até bun 1.3).
//
// Uso (no CI):  bun test --coverage | tee /dev/stderr | bun run scripts/check-coverage.ts
//
// Variáveis de ambiente:
//   COVERAGE_MIN_LINES     default 80  — line coverage mínimo (%)
//   COVERAGE_MIN_FUNCTIONS default 80  — function coverage mínimo (%)
//
// Quando subir testes na Onda 2/3, aumente os defaults aqui.

const minLines = Number(process.env.COVERAGE_MIN_LINES ?? '80');
const minFns = Number(process.env.COVERAGE_MIN_FUNCTIONS ?? '80');

let input = '';
for await (const chunk of Bun.stdin.stream()) input += new TextDecoder().decode(chunk);

const m = input.match(/^All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/m);
if (!m) {
  console.error('check-coverage: linha "All files" não encontrada na saída.');
  process.exit(2);
}

const funcs = Number(m[1]);
const lines = Number(m[2]);

const ok = funcs >= minFns && lines >= minLines;
const status = ok ? 'OK' : 'FAIL';

console.error(
  `\ncheck-coverage [${status}] lines=${lines}% (min ${minLines}%) funcs=${funcs}% (min ${minFns}%)`,
);

if (!ok) process.exit(1);
