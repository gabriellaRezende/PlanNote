// Armazenamento em arquivos: cada caderno é uma pasta, cada folha é um arquivo JSON.
//
//   <pasta de dados>/
//     cadernos/<idCaderno>/caderno.json
//     cadernos/<idCaderno>/folhas/<idFolha>.json
//     provas.json
//     .lixeira/            (o que for excluído vem para cá, nada é apagado de vez)
//
// Um arquivo por folha evita conflitos quando a pasta está no iCloud Drive ou OneDrive.

const fs = require('fs/promises');
const path = require('path');

const ID_RE = /^[A-Za-z0-9-]{6,64}$/;
const MAX_TITLE = 300;
const MAX_CONTENT = 5 * 1024 * 1024; // 5 MB de texto por folha

function assertId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new Error('Identificador inválido.');
  }
}

function str(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isoOr(value, fallback) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function createStorage(dataDir) {
  const notebooksDir = path.join(dataDir, 'cadernos');
  const examsFile = path.join(dataDir, 'provas.json');
  const trashDir = path.join(dataDir, '.lixeira');

  const notebookDir = (id) => path.join(notebooksDir, id);
  const pagesDir = (id) => path.join(notebookDir(id), 'folhas');

  async function moveToTrash(target, name) {
    if (!(await exists(target))) return;
    await fs.mkdir(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.rename(target, path.join(trashDir, `${stamp}-${name}`));
  }

  function cleanNotebook(nb) {
    assertId(nb?.id);
    const now = new Date().toISOString();
    return {
      id: nb.id,
      title: str(nb.title, MAX_TITLE) || 'Caderno sem nome',
      color: str(nb.color, 32) || 'azul',
      createdAt: isoOr(nb.createdAt, now),
      updatedAt: isoOr(nb.updatedAt, now),
    };
  }

  function cleanPage(page) {
    assertId(page?.id);
    const now = new Date().toISOString();
    return {
      id: page.id,
      title: str(page.title, MAX_TITLE),
      content: str(page.content, MAX_CONTENT),
      createdAt: isoOr(page.createdAt, now),
      updatedAt: isoOr(page.updatedAt, now),
    };
  }

  function cleanExam(exam) {
    assertId(exam?.id);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(exam.date) ? exam.date : null;
    if (!date) throw new Error('Data da prova inválida.');
    return {
      id: exam.id,
      title: str(exam.title, MAX_TITLE) || 'Prova',
      notebookId: typeof exam.notebookId === 'string' && ID_RE.test(exam.notebookId) ? exam.notebookId : null,
      date,
      time: /^\d{2}:\d{2}$/.test(exam.time) ? exam.time : '',
      notes: str(exam.notes, 5000),
    };
  }

  return {
    dataDir,

    async loadAll() {
      const problems = [];
      const notebooks = [];
      await fs.mkdir(notebooksDir, { recursive: true });

      const entries = await fs.readdir(notebooksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
        let nb;
        try {
          nb = cleanNotebook(await readJson(path.join(notebookDir(entry.name), 'caderno.json')));
        } catch (err) {
          problems.push(`Caderno ${entry.name}: ${err.message}`);
          continue;
        }
        nb.pages = [];
        let pageFiles = [];
        try {
          pageFiles = await fs.readdir(pagesDir(nb.id));
        } catch (err) {
          if (err.code !== 'ENOENT') problems.push(`Folhas de ${nb.title}: ${err.message}`);
        }
        for (const file of pageFiles) {
          if (!file.endsWith('.json')) continue;
          try {
            nb.pages.push(cleanPage(await readJson(path.join(pagesDir(nb.id), file))));
          } catch (err) {
            problems.push(`Folha ${file} em ${nb.title}: ${err.message}`);
          }
        }
        notebooks.push(nb);
      }

      let exams = [];
      try {
        const raw = await readJson(examsFile);
        const list = Array.isArray(raw?.provas) ? raw.provas : [];
        for (const e of list) {
          try {
            exams.push(cleanExam(e));
          } catch (err) {
            problems.push(`Prova ${e?.title ?? ''}: ${err.message}`);
          }
        }
      } catch (err) {
        if (err.code !== 'ENOENT') problems.push(`provas.json: ${err.message}`);
      }

      return { dataDir, notebooks, exams, problems };
    },

    async saveNotebook(nb) {
      const clean = cleanNotebook(nb);
      await writeJsonAtomic(path.join(notebookDir(clean.id), 'caderno.json'), clean);
      return clean;
    },

    async deleteNotebook(id) {
      assertId(id);
      await moveToTrash(notebookDir(id), `caderno-${id}`);
    },

    async savePage(notebookId, page) {
      assertId(notebookId);
      const clean = cleanPage(page);
      await writeJsonAtomic(path.join(pagesDir(notebookId), `${clean.id}.json`), clean);
      return clean;
    },

    async deletePage(notebookId, pageId) {
      assertId(notebookId);
      assertId(pageId);
      await moveToTrash(path.join(pagesDir(notebookId), `${pageId}.json`), `folha-${pageId}.json`);
    },

    async saveExams(exams) {
      if (!Array.isArray(exams)) throw new Error('Lista de provas inválida.');
      const clean = exams.map(cleanExam);
      await writeJsonAtomic(examsFile, { versao: 1, provas: clean });
      return clean;
    },
  };
}

// Diz se uma pasta já tem dados do PlanNote (para não sobrescrever ao trocar de pasta).
async function hasPlanNoteData(dir) {
  return (await exists(path.join(dir, 'cadernos'))) || (await exists(path.join(dir, 'provas.json')));
}

async function isEmptyDir(dir) {
  try {
    const items = (await fs.readdir(dir)).filter((n) => !n.startsWith('.'));
    return items.length === 0;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

module.exports = { createStorage, hasPlanNoteData, isEmptyDir, ID_RE };
