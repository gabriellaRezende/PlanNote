import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStorage } = require('../electron/storage.cjs');

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'plannote-test-'));
}

test('salva e lê cadernos, folhas e provas', async () => {
  const dir = await tempDir();
  const s = createStorage(dir);
  await s.saveNotebook({ id: 'caderno-1', title: 'Direito Civil', color: 'verde' });
  await s.savePage('caderno-1', { id: 'folha-01', title: 'Contratos', content: '<p>Oi</p>' });
  await s.saveExams([{ id: 'prova-1', title: 'P1', notebookId: 'caderno-1', date: '2026-12-10', time: '08:00' }]);

  const data = await s.loadAll();
  assert.equal(data.notebooks.length, 1);
  assert.equal(data.notebooks[0].title, 'Direito Civil');
  assert.equal(data.notebooks[0].pages[0].title, 'Contratos');
  assert.equal(data.exams[0].date, '2026-12-10');
  assert.deepEqual(data.problems, []);
});

test('excluir manda para a .lixeira em vez de apagar', async () => {
  const dir = await tempDir();
  const s = createStorage(dir);
  await s.saveNotebook({ id: 'caderno-1', title: 'A' });
  await s.savePage('caderno-1', { id: 'folha-01', title: 'X' });
  await s.deletePage('caderno-1', 'folha-01');
  await s.deleteNotebook('caderno-1');

  const data = await s.loadAll();
  assert.equal(data.notebooks.length, 0);
  const trash = await fs.readdir(path.join(dir, '.lixeira'));
  assert.equal(trash.length, 2);
});

test('recusa identificadores que tentariam sair da pasta', async () => {
  const s = createStorage(await tempDir());
  await assert.rejects(s.saveNotebook({ id: '../../fora', title: 'x' }));
  await assert.rejects(s.savePage('caderno-1', { id: '../x', title: 'x' }));
  await assert.rejects(s.saveExams([{ id: 'prova-1', title: 'P', date: 'amanhã' }]));
});

test('arquivo corrompido não impede de abrir o resto', async () => {
  const dir = await tempDir();
  const s = createStorage(dir);
  await s.saveNotebook({ id: 'caderno-1', title: 'Bom' });
  await s.savePage('caderno-1', { id: 'folha-01', title: 'Ok' });
  await fs.writeFile(path.join(dir, 'cadernos', 'caderno-1', 'folhas', 'folha-02.json'), '{quebrado');

  const data = await s.loadAll();
  assert.equal(data.notebooks[0].pages.length, 1);
  assert.equal(data.problems.length, 1);
});
