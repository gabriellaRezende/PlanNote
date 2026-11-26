import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, normalize, searchPages, snippet } from '../src/lib/text.js';

test('busca ignora acentos e maiúsculas', () => {
  assert.equal(normalize('Função Social do CONTRATO'), 'funcao social do contrato');
  assert.equal(fold('Ação').length, 'Ação'.length);
});

test('trecho destaca a palavra com o acento original', () => {
  const s = snippet('O princípio da função social limita a autonomia.', 'funcao');
  assert.equal(s.match, 'função');
  assert.ok(s.before.endsWith('da '));
});

test('todas as palavras precisam aparecer; título vale mais', () => {
  const nb = { id: 'n1', title: 'Civil' };
  const items = [
    { notebook: nb, page: { title: 'Contratos', updatedAt: '2026-11-01' }, text: 'boa-fé objetiva' },
    { notebook: nb, page: { title: 'Posse', updatedAt: '2026-11-20' }, text: 'contratos de comodato e boa-fé' },
    { notebook: nb, page: { title: 'Família', updatedAt: '2026-11-21' }, text: 'casamento' },
  ];
  const results = searchPages(items, 'contratos boa-fe');
  assert.deepEqual(results.map((r) => r.page.title), ['Contratos', 'Posse']);
  assert.equal(searchPages(items, '   ').length, 0);
});
