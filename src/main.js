import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/theme.css';
import './styles/app.css';

import { h, replace, icon } from './lib/dom.js';
import { newId, COVERS, coverVar } from './lib/ids.js';
import {
  addDays,
  countdown,
  formatBR,
  formatDateTime,
  formatShort,
  monthGrid,
  monthLabel,
  toISO,
  todayISO,
  WEEKDAYS,
} from './lib/dates.js';
import { searchPages, snippet } from './lib/text.js';
import { buildToolbar, mountEditor } from './editor.js';
import { openModal, confirmModal, toast } from './modal.js';
import { WELCOME_HTML } from './welcome.js';

const api = window.plannote;
const $ = (id) => document.getElementById(id);

document.body.classList.add(`platform-${api?.platform || 'web'}`);

const now = () => new Date().toISOString();
const today = new Date();

const state = {
  notebooks: [],
  exams: [],
  view: 'notebook', // 'notebook' | 'exams'
  notebookId: null,
  pageId: null,
  query: '',
  cal: { y: today.getFullYear(), m: today.getMonth() },
  dataDir: '',
  version: '',
};

const lastPageByNotebook = new Map();
let editor = null;
let editorPageId = null;
let refreshToolbar = () => {};

// ---------- Utilidades ----------

const nbById = (id) => state.notebooks.find((n) => n.id === id) || null;
const currentNotebook = () => nbById(state.notebookId);
const currentPage = () => currentNotebook()?.pages.find((p) => p.id === state.pageId) || null;

const byCreated = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');
const sortedPages = (nb) => [...nb.pages].sort(byCreated);
const pad2 = (n) => String(n).padStart(2, '0');

function errMsg(err) {
  return String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('p, h1, h2, h3, li, blockquote').forEach((el) => el.append(' '));
  return doc.body.textContent || '';
}

function pageText(page) {
  if (page._text === undefined) page._text = htmlToText(page.content);
  return page._text;
}

const plainNotebook = (nb) => ({ id: nb.id, title: nb.title, color: nb.color, createdAt: nb.createdAt, updatedAt: nb.updatedAt });
const plainPage = (p) => ({ id: p.id, title: p.title, content: p.content, createdAt: p.createdAt, updatedAt: p.updatedAt });
const plainExam = (e) => ({ id: e.id, title: e.title, notebookId: e.notebookId, date: e.date, time: e.time, notes: e.notes });

function sortExams(list) {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'));
}

function upcomingExams(notebookId) {
  const t = todayISO();
  return sortExams(state.exams.filter((e) => e.date >= t && (notebookId === undefined || e.notebookId === notebookId)));
}

function rememberSelection() {
  if (state.notebookId && state.pageId) lastPageByNotebook.set(state.notebookId, state.pageId);
  try {
    localStorage.setItem('plannote:last', JSON.stringify({ notebookId: state.notebookId, pageId: state.pageId }));
  } catch {
    // Sem armazenamento local: só não lembra a última folha aberta.
  }
}

function field(label, control) {
  return h('label', { class: 'field' }, h('span', {}, label), control);
}

// ---------- Salvamento automático ----------

const dirtyPages = new Map(); // idFolha -> idCaderno
let saveTimer = null;
let saveChain = Promise.resolve();

function setStatus(text, error = false) {
  const el = $('save-status');
  el.textContent = text;
  el.classList.toggle('error', error);
}

function markPageDirty(nb, page) {
  page.updatedAt = now();
  dirtyPages.set(page.id, nb.id);
  setStatus('Salvando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPages, 600);
}

function flushPages() {
  clearTimeout(saveTimer);
  saveChain = saveChain.then(async () => {
    if (!dirtyPages.size) return;
    const entries = [...dirtyPages];
    dirtyPages.clear();
    let failure = null;
    for (const [pageId, nbId] of entries) {
      const page = nbById(nbId)?.pages.find((p) => p.id === pageId);
      if (!page) continue;
      try {
        await api.savePage(nbId, plainPage(page));
      } catch (err) {
        failure = err;
        if (!dirtyPages.has(pageId)) dirtyPages.set(pageId, nbId);
      }
    }
    if (failure) {
      setStatus('Não foi possível salvar. Tentando de novo…', true);
      console.error(failure);
      saveTimer = setTimeout(flushPages, 4000);
    } else if (!dirtyPages.size) {
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setStatus(`Salvo às ${time}`);
      if (state.view === 'notebook') renderPagesCol();
    }
  });
  return saveChain;
}

async function persist(action, failMessage) {
  try {
    return await action();
  } catch (err) {
    toast(`${failMessage} ${errMsg(err)}`, { error: true, ms: 6000 });
    throw err;
  }
}

const saveExams = () => persist(() => api.saveExams(state.exams.map(plainExam)), 'Não foi possível salvar as provas.');

// ---------- Navegação ----------

function selectNotebook(id) {
  flushPages();
  const nb = nbById(id);
  state.view = 'notebook';
  state.notebookId = nb ? nb.id : null;
  state.pageId = null;
  if (nb) {
    const remembered = lastPageByNotebook.get(nb.id);
    const page =
      nb.pages.find((p) => p.id === remembered) ||
      [...nb.pages].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    state.pageId = page?.id || null;
  }
  rememberSelection();
  render();
}

function selectPage(nbId, pageId) {
  flushPages();
  state.view = 'notebook';
  state.notebookId = nbId;
  state.pageId = pageId;
  rememberSelection();
  render();
}

function showExams() {
  flushPages();
  state.view = 'exams';
  clearSearch(false);
  render();
}

function clearSearch(doRender = true) {
  state.query = '';
  $('search').value = '';
  if (doRender) render();
}

// ---------- Cadernos ----------

function openNotebookModal(existing = null) {
  const titleInput = h('input', {
    type: 'text',
    id: 'nb-title',
    value: existing?.title || '',
    placeholder: 'Ex.: Direito Civil',
    maxlength: '300',
  });
  let color = existing?.color || COVERS[state.notebooks.length % COVERS.length].id;

  const swatches = h(
    'div',
    { class: 'swatches', role: 'radiogroup', 'aria-label': 'Cor da capa' },
    COVERS.map((c) =>
      h(
        'label',
        { class: 'swatch', title: c.label, style: { '--cover': coverVar(c.id) } },
        h('input', {
          type: 'radio',
          name: 'nb-color',
          id: `nb-color-${c.id}`,
          value: c.id,
          checked: c.id === color,
          'aria-label': c.label,
          onChange: () => {
            color = c.id;
          },
        }),
        h('span'),
      ),
    ),
  );

  const actions = [];
  if (existing) {
    actions.push({
      label: 'Excluir caderno',
      kind: 'danger',
      left: true,
      onClick: async (close) => {
        close();
        await deleteNotebook(existing);
      },
    });
  }
  actions.push(
    { label: 'Cancelar', onClick: (close) => close() },
    {
      label: existing ? 'Salvar' : 'Criar caderno',
      kind: 'primary',
      onClick: async (close) => {
        const title = titleInput.value.trim();
        if (!title) {
          titleInput.focus();
          return;
        }
        if (existing) {
          existing.title = title;
          existing.color = color;
          existing.updatedAt = now();
          await persist(() => api.saveNotebook(plainNotebook(existing)), 'Não foi possível salvar o caderno.');
          close();
          render();
        } else {
          const nb = { id: newId(), title, color, createdAt: now(), updatedAt: now(), pages: [] };
          await persist(() => api.saveNotebook(plainNotebook(nb)), 'Não foi possível criar o caderno.');
          state.notebooks.push(nb);
          close();
          clearSearch(false);
          selectNotebook(nb.id);
        }
      },
    },
  );

  openModal({
    title: existing ? 'Editar caderno' : 'Novo caderno',
    body: [field('Nome do caderno', titleInput), h('div', { class: 'field' }, h('span', {}, 'Cor da capa'), swatches)],
    actions,
  });
}

async function deleteNotebook(nb) {
  const count = nb.pages.length;
  const ok = await confirmModal({
    title: `Excluir "${nb.title}"?`,
    message: `O caderno e ${count === 1 ? 'a única folha dele' : `as ${count} folhas dele`} vão para a pasta .lixeira dentro da sua pasta de dados. Dá para recuperar copiando de volta.`,
    confirmLabel: 'Excluir caderno',
  });
  if (!ok) return;
  flushPages();
  await saveChain;
  await persist(() => api.deleteNotebook(nb.id), 'Não foi possível excluir o caderno.');
  if (editorPageId && nb.pages.some((p) => p.id === editorPageId)) destroyEditor();
  state.notebooks = state.notebooks.filter((n) => n.id !== nb.id);
  lastPageByNotebook.delete(nb.id);

  let examsChanged = false;
  for (const exam of state.exams) {
    if (exam.notebookId === nb.id) {
      exam.notebookId = null;
      examsChanged = true;
    }
  }
  if (examsChanged) await saveExams();

  toast(`Caderno "${nb.title}" excluído.`);
  selectNotebook(state.notebooks[0]?.id || null);
}

// ---------- Folhas ----------

async function createPage() {
  let nb = currentNotebook();
  if (!nb) {
    if (!state.notebooks.length) {
      openNotebookModal();
      return;
    }
    nb = state.notebooks[0];
  }
  flushPages();
  const page = { id: newId(), title: '', content: '', createdAt: now(), updatedAt: now(), _text: '' };
  await persist(() => api.savePage(nb.id, plainPage(page)), 'Não foi possível criar a folha.');
  nb.pages.push(page);
  clearSearch(false);
  selectPage(nb.id, page.id);
  $('sheet-title').focus();
}

async function deletePage() {
  const nb = currentNotebook();
  const page = currentPage();
  if (!nb || !page) return;
  const ok = await confirmModal({
    title: `Excluir a folha "${page.title || 'sem assunto'}"?`,
    message: 'A folha vai para a pasta .lixeira dentro da sua pasta de dados.',
    confirmLabel: 'Excluir folha',
  });
  if (!ok) return;
  flushPages();
  await saveChain;
  await persist(() => api.deletePage(nb.id, page.id), 'Não foi possível excluir a folha.');
  destroyEditor();
  const ordered = sortedPages(nb);
  const idx = ordered.indexOf(page);
  nb.pages = nb.pages.filter((p) => p.id !== page.id);
  const next = ordered[idx + 1] || ordered[idx - 1];
  selectPage(nb.id, next && next.id !== page.id ? next.id : null);
}

// ---------- Provas ----------

function openExamModal(existing = null, presetDate = null) {
  const titleInput = h('input', {
    type: 'text',
    id: 'exam-title',
    value: existing?.title || '',
    placeholder: 'Ex.: P1 de Direito Civil',
    maxlength: '300',
  });

  const defaultNotebook = existing ? existing.notebookId : state.view === 'notebook' ? state.notebookId : null;
  const notebookSelect = h(
    'select',
    { id: 'exam-notebook' },
    h('option', { value: '' }, 'Sem caderno'),
    state.notebooks.map((nb) => h('option', { value: nb.id, selected: nb.id === defaultNotebook }, nb.title)),
  );

  const dateInput = h('input', {
    type: 'date',
    id: 'exam-date',
    value: existing?.date || presetDate || addDays(todayISO(), 7),
    required: true,
  });
  const timeInput = h('input', { type: 'time', id: 'exam-time', value: existing?.time || '' });
  const notesInput = h('textarea', { id: 'exam-notes', placeholder: 'Conteúdo da prova, sala, o que levar… (opcional)', maxlength: '5000' });
  notesInput.value = existing?.notes || '';

  const actions = [];
  if (existing) {
    actions.push({
      label: 'Excluir',
      kind: 'danger',
      left: true,
      onClick: async (close) => {
        state.exams = state.exams.filter((e) => e.id !== existing.id);
        await saveExams();
        close();
        render();
        toast('Prova excluída.');
      },
    });
  }
  actions.push(
    { label: 'Cancelar', onClick: (close) => close() },
    {
      label: existing ? 'Salvar' : 'Marcar prova',
      kind: 'primary',
      onClick: async (close) => {
        const title = titleInput.value.trim();
        if (!title) return titleInput.focus();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) return dateInput.focus();
        const data = {
          title,
          notebookId: notebookSelect.value || null,
          date: dateInput.value,
          time: timeInput.value || '',
          notes: notesInput.value.trim(),
        };
        if (existing) Object.assign(existing, data);
        else state.exams.push({ id: newId(), ...data });
        await saveExams();
        const [y, m] = data.date.split('-').map(Number);
        state.cal = { y, m: m - 1 };
        close();
        render();
      },
    },
  );

  openModal({
    title: existing ? 'Editar prova' : 'Nova prova',
    body: [
      field('Prova', titleInput),
      field('Caderno', notebookSelect),
      h('div', { class: 'field-row' }, field('Data', dateInput), field('Horário (opcional)', timeInput)),
      field('Anotações', notesInput),
    ],
    actions,
  });
}

// ---------- Configurações ----------

function openSettings() {
  const pathBox = h('div', { class: 'path-box' }, state.dataDir);

  const changeFolder = async () => {
    await flushPages();
    let res;
    try {
      res = await api.chooseDataDir();
    } catch (err) {
      toast(`Não foi possível usar essa pasta. ${errMsg(err)}`, { error: true, ms: 6000 });
      return;
    }
    if (!res?.changed) return;
    destroyEditor();
    await loadData();
    pathBox.textContent = state.dataDir;
    toast(
      res.mode === 'copiou'
        ? 'Pronto. Seus cadernos foram copiados para a nova pasta.'
        : 'Pronto. O PlanNote agora usa os cadernos que já estavam nessa pasta.',
      { ms: 5000 },
    );
  };

  openModal({
    title: 'Configurações',
    body: [
      h('div', { class: 'field' }, h('span', {}, 'Pasta dos seus cadernos'), pathBox),
      h(
        'div',
        { class: 'inline-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => api.openDataDir() }, 'Abrir pasta'),
        h('button', { type: 'button', class: 'btn', onClick: changeFolder }, 'Trocar pasta…'),
      ),
      h(
        'p',
        {},
        'Seus cadernos ficam nessa pasta como arquivos comuns. Para fazer backup, é só copiar a pasta. ',
        'Se você escolher uma pasta dentro do iCloud Drive, OneDrive ou Dropbox, os cadernos aparecem iguais em outro computador com o PlanNote.',
      ),
      h('p', { class: 'small-note' }, `O que você excluir vai para a pasta .lixeira dentro dela. PlanNote ${state.version}`),
    ],
    actions: [{ label: 'Fechar', kind: 'primary', onClick: (close) => close() }],
  });
}

// ---------- Desenho da tela ----------

function render() {
  const examsView = state.view === 'exams';
  $('app').classList.toggle('view-exams', examsView);
  $('pages-col').hidden = examsView;
  $('editor-col').hidden = examsView;
  $('exams-view').hidden = !examsView;
  renderSidebar();
  if (examsView) {
    destroyEditor();
    renderExams();
  } else {
    renderPagesCol();
    renderEditor();
  }
}

function renderSidebar() {
  const upcoming = upcomingExams();
  const next = upcoming[0];
  replace(
    $('nav-exams'),
    h(
      'button',
      {
        type: 'button',
        class: `nav-item ${state.view === 'exams' ? 'active' : ''}`,
        onClick: showExams,
      },
      icon('calendar'),
      h('span', { class: 'nav-label' }, 'Provas'),
      upcoming.length ? h('span', { class: 'nav-count' }, upcoming.length) : null,
    ),
    next
      ? h('div', { class: 'next-exam' }, 'Próxima: ', h('strong', {}, next.title), ` · ${countdown(next.date).label}`)
      : null,
  );

  const searching = Boolean(state.query.trim());
  replace(
    $('notebook-list'),
    state.notebooks.map((nb) =>
      h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: `nav-item ${state.view === 'notebook' && !searching && nb.id === state.notebookId ? 'active' : ''}`,
            onClick: () => {
              clearSearch(false);
              selectNotebook(nb.id);
            },
          },
          h('span', { class: 'spine', style: { '--cover': coverVar(nb.color) } }),
          h('span', { class: 'nav-label' }, nb.title),
          h('span', { class: 'nav-count' }, nb.pages.length),
        ),
      ),
    ),
  );
}

function renderPagesCol() {
  const col = $('pages-col');
  const query = state.query.trim();

  if (query) {
    const items = state.notebooks.flatMap((notebook) => notebook.pages.map((page) => ({ notebook, page, text: pageText(page) })));
    const results = searchPages(items, query);
    replace(
      col,
      h(
        'div',
        { class: 'col-header drag' },
        h('div', { class: 'col-title-row' }, h('h1', { class: 'col-title' }, 'Busca')),
        h(
          'div',
          { class: 'col-sub' },
          results.length === 0
            ? `Nada encontrado para "${query}".`
            : `${results.length} ${results.length === 1 ? 'folha encontrada' : 'folhas encontradas'}`,
        ),
      ),
      h(
        'ul',
        { class: 'page-list' },
        results.map(({ notebook, page, text }) => {
          const snip = snippet(text, query.split(/\s+/)[0], 28);
          return h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: `page-item ${page.id === state.pageId ? 'active' : ''}`,
                onClick: () => selectPage(notebook.id, page.id),
              },
              h('span', { class: 'page-num' }, h('span', { class: 'spine', style: { '--cover': coverVar(notebook.color) } })),
              h('span', { class: `page-title ${page.title ? '' : 'untitled'}` }, page.title || 'Sem assunto'),
              h(
                'span',
                { class: snip ? 'page-meta snippet' : 'page-meta' },
                snip ? [snip.before, h('mark', {}, snip.match), snip.after] : notebook.title,
              ),
            ),
          );
        }),
      ),
    );
    return;
  }

  const nb = currentNotebook();
  if (!nb) {
    replace(
      col,
      h('div', { class: 'col-header drag' }, h('div', { class: 'col-title-row' }, h('h1', { class: 'col-title' }, 'Folhas'))),
      h('div', { class: 'col-empty' }, 'Crie um caderno na coluna ao lado para começar a escrever.'),
    );
    return;
  }

  const pages = sortedPages(nb);
  const next = upcomingExams(nb.id)[0];
  const cd = next ? countdown(next.date) : null;

  replace(
    col,
    h(
      'div',
      { class: 'col-header drag' },
      h(
        'div',
        { class: 'col-title-row' },
        h('span', { class: 'spine', style: { '--cover': coverVar(nb.color) } }),
        h('h1', { class: 'col-title', title: nb.title }, nb.title),
        h(
          'button',
          { type: 'button', class: 'icon-btn', title: 'Editar caderno', 'aria-label': 'Editar caderno', onClick: () => openNotebookModal(nb) },
          icon('more'),
        ),
      ),
      next
        ? h(
            'button',
            { type: 'button', class: `exam-chip tone-${cd.tone}`, onClick: showExams, title: 'Ver provas' },
            `${next.title} · ${cd.label}`,
          )
        : null,
      h(
        'div',
        { class: 'col-title-row' },
        h('span', { class: 'col-sub', style: { flex: '1' } }, `${pages.length} ${pages.length === 1 ? 'folha' : 'folhas'}`),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: createPage }, icon('plus'), 'Nova folha'),
      ),
    ),
    pages.length
      ? h(
          'ul',
          { class: 'page-list', id: 'page-list' },
          pages.map((page, i) =>
            h(
              'li',
              {},
              h(
                'button',
                {
                  type: 'button',
                  class: `page-item ${page.id === state.pageId ? 'active' : ''}`,
                  onClick: () => selectPage(nb.id, page.id),
                },
                h('span', { class: 'page-num' }, `Fl. ${pad2(i + 1)}`),
                h('span', { class: `page-title ${page.title ? '' : 'untitled'}` }, page.title || 'Sem assunto'),
                h('span', { class: 'page-meta' }, `editada ${formatDateTime(page.updatedAt)}`),
              ),
            ),
          ),
        )
      : h('div', { class: 'col-empty' }, 'Este caderno ainda não tem folhas. Clique em "Nova folha" para começar.'),
  );

  col.querySelector('.page-item.active')?.scrollIntoView({ block: 'nearest' });
}

function destroyEditor() {
  if (editor) {
    editor.destroy();
    editor = null;
  }
  editorPageId = null;
  refreshToolbar();
}

function renderEditor() {
  const nb = currentNotebook();
  const page = currentPage();
  const empty = $('editor-empty');

  if (!page) {
    destroyEditor();
    $('sheet-scroll').hidden = true;
    empty.hidden = false;
    let card;
    if (!state.notebooks.length) {
      card = [
        h('div', { class: 'empty-art', 'aria-hidden': 'true' }),
        h('h2', {}, 'Seu primeiro caderno'),
        h('p', {}, 'Crie um caderno para cada matéria. Dentro dele, cada folha é um assunto.'),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => openNotebookModal() }, 'Criar caderno'),
      ];
    } else if (nb && !nb.pages.length) {
      card = [
        h('div', { class: 'empty-art', 'aria-hidden': 'true' }),
        h('h2', {}, 'Caderno em branco'),
        h('p', {}, `Escreva a primeira folha de ${nb.title}. O assunto vira o título da folha.`),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: createPage }, 'Nova folha'),
      ];
    } else {
      card = [h('h2', {}, 'Escolha uma folha'), h('p', {}, 'Abra uma folha na lista ao lado ou crie uma nova.')];
    }
    replace(empty, h('div', { class: 'empty-card' }, card));
    return;
  }

  $('sheet-scroll').hidden = false;
  empty.hidden = true;

  if (editorPageId !== page.id) {
    destroyEditor();
    const number = sortedPages(nb).indexOf(page) + 1;
    $('sheet-num').textContent = `Folha ${pad2(number)}`;
    $('sheet-date').textContent = `Data ${formatBR(toISO(new Date(page.createdAt)))}`;
    $('sheet-title').value = page.title;
    editorPageId = page.id;
    const owner = nb;
    editor = mountEditor($('editor'), page.content, {
      onChange: (ed) => {
        page.content = ed.getHTML();
        page._text = ed.getText({ blockSeparator: ' ' });
        markPageDirty(owner, page);
      },
      onState: () => refreshToolbar(),
    });
    $('sheet-scroll').scrollTop = 0;
    setStatus('');
    refreshToolbar();
  }
}

function renderExams() {
  const t = todayISO();
  const upcoming = upcomingExams();
  const past = sortExams(state.exams.filter((e) => e.date < t)).reverse().slice(0, 30);
  const in30 = upcoming.filter((e) => countdown(e.date, t).days <= 30).length;

  $('exams-sub').textContent = upcoming.length
    ? `${in30} ${in30 === 1 ? 'prova' : 'provas'} nos próximos 30 dias`
    : 'Nenhuma prova marcada.';

  const card = (exam) => {
    const cd = countdown(exam.date, t);
    const nb = nbById(exam.notebookId);
    let box;
    if (cd.days === 0 || cd.days === 1) box = h('div', { class: `countdown word tone-${cd.tone}` }, h('span', { class: 'num' }, cd.label));
    else if (cd.days > 1) box = h('div', { class: `countdown tone-${cd.tone}` }, h('span', { class: 'num' }, cd.days), h('span', { class: 'unit' }, 'dias'));
    else box = h('div', { class: 'countdown word tone-past' }, h('span', { class: 'num' }, cd.label));

    return h(
      'button',
      { type: 'button', class: `exam-card ${cd.days < 0 ? 'is-past' : ''}`, onClick: () => openExamModal(exam) },
      box,
      h(
        'div',
        { class: 'exam-info' },
        h('span', { class: 'exam-title' }, exam.title),
        h(
          'span',
          { class: 'exam-meta' },
          nb ? h('span', { class: 'spine', style: { '--cover': coverVar(nb.color) } }) : null,
          h('span', {}, [nb ? nb.title : 'Sem caderno', formatShort(exam.date), exam.time].filter(Boolean).join(' · ')),
        ),
      ),
    );
  };

  replace(
    $('exam-list'),
    upcoming.length
      ? [h('div', { class: 'exam-group-label' }, 'Próximas'), upcoming.map(card)]
      : h('div', { class: 'col-empty' }, 'Marque suas provas para ver aqui quantos dias faltam para cada uma.'),
    past.length ? [h('div', { class: 'exam-group-label' }, 'Já passaram'), past.map(card)] : null,
  );

  // Calendário
  const { y, m } = state.cal;
  $('cal-title').textContent = monthLabel(y, m);
  let days = monthGrid(y, m);
  if (!days[35].inMonth) days = days.slice(0, 35);

  const byDate = new Map();
  for (const exam of sortExams(state.exams)) {
    if (!byDate.has(exam.date)) byDate.set(exam.date, []);
    byDate.get(exam.date).push(exam);
  }

  replace(
    $('cal-grid'),
    WEEKDAYS.map((d) => h('div', { class: 'cal-dow' }, d)),
    days.map((d) =>
      h(
        'div',
        {
          class: `cal-day ${d.inMonth ? '' : 'out'} ${d.iso === t ? 'today' : ''}`,
          role: 'button',
          tabindex: '0',
          'aria-label': `${formatBR(d.iso)}: marcar prova`,
          onClick: () => openExamModal(null, d.iso),
          onKeydown: (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              openExamModal(null, d.iso);
            }
          },
        },
        h('span', { class: 'daynum' }, d.day),
        (byDate.get(d.iso) || []).map((exam) => {
          const nb = nbById(exam.notebookId);
          return h(
            'button',
            {
              type: 'button',
              class: 'cal-event',
              title: exam.title,
              onClick: (ev) => {
                ev.stopPropagation();
                openExamModal(exam);
              },
            },
            h('span', { class: 'spine', style: { '--cover': coverVar(nb?.color) } }),
            h('span', {}, exam.time ? `${exam.time} ${exam.title}` : exam.title),
          );
        }),
      ),
    ),
  );
}

// ---------- Carregar dados ----------

async function seedWelcome() {
  const stamp = now();
  const nb = { id: newId(), title: 'Comece aqui', color: 'azul', createdAt: stamp, updatedAt: stamp, pages: [] };
  const page = { id: newId(), title: 'Como usar o PlanNote', content: WELCOME_HTML, createdAt: stamp, updatedAt: stamp };
  await api.saveNotebook(plainNotebook(nb));
  await api.savePage(nb.id, plainPage(page));
  nb.pages.push(page);
  state.notebooks.push(nb);
  state.exams.push({
    id: newId(),
    title: 'Exemplo de prova (pode excluir)',
    notebookId: nb.id,
    date: addDays(todayISO(), 10),
    time: '',
    notes: 'Clique numa prova para editar ou excluir.',
  });
  await api.saveExams(state.exams.map(plainExam));
  await api.setWelcomed();
}

async function loadData() {
  const data = await api.loadAll();
  state.notebooks = data.notebooks.sort(byCreated);
  state.exams = data.exams;
  state.dataDir = data.dataDir;

  if (data.problems.length) {
    console.warn('Arquivos que não puderam ser lidos:', data.problems);
    toast(`${data.problems.length} arquivo(s) da pasta de dados não puderam ser lidos. Primeiro: ${data.problems[0]}`, {
      error: true,
      ms: 8000,
    });
  }

  let last = {};
  try {
    last = JSON.parse(localStorage.getItem('plannote:last') || '{}') || {};
  } catch {
    last = {};
  }
  const nb = nbById(last.notebookId) || state.notebooks[0] || null;
  if (nb && last.pageId && nb.pages.some((p) => p.id === last.pageId)) lastPageByNotebook.set(nb.id, last.pageId);
  selectNotebook(nb?.id || null);
}

// ---------- Início ----------

async function start() {
  // Ícones fixos
  $('search-wrap').prepend(icon('search'));
  $('add-notebook').append(icon('plus'));
  $('open-settings').append(icon('settings'), h('span', { class: 'nav-label' }, 'Configurações'));
  $('cal-prev').append(icon('chevronLeft'));
  $('cal-next').append(icon('chevronRight'));

  refreshToolbar = buildToolbar($('tools'), () => editor);

  // Eventos
  $('add-notebook').addEventListener('click', () => openNotebookModal());
  $('open-settings').addEventListener('click', openSettings);
  $('add-exam').addEventListener('click', () => openExamModal());
  $('delete-page').addEventListener('click', deletePage);

  $('cal-prev').addEventListener('click', () => {
    const d = new Date(state.cal.y, state.cal.m - 1, 1);
    state.cal = { y: d.getFullYear(), m: d.getMonth() };
    renderExams();
  });
  $('cal-next').addEventListener('click', () => {
    const d = new Date(state.cal.y, state.cal.m + 1, 1);
    state.cal = { y: d.getFullYear(), m: d.getMonth() };
    renderExams();
  });
  $('cal-today').addEventListener('click', () => {
    const d = new Date();
    state.cal = { y: d.getFullYear(), m: d.getMonth() };
    renderExams();
  });

  $('sheet-title').addEventListener('input', (ev) => {
    const nb = currentNotebook();
    const page = currentPage();
    if (!nb || !page) return;
    page.title = ev.target.value;
    markPageDirty(nb, page);
  });
  $('sheet-title').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && editor) {
      ev.preventDefault();
      editor.commands.focus('start');
    }
  });

  $('search').addEventListener('input', (ev) => {
    state.query = ev.target.value;
    if (state.query.trim() && state.view === 'exams') state.view = 'notebook';
    render();
  });
  $('search').addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      clearSearch();
      ev.target.blur();
    }
  });

  api.onMenu((action) => {
    if (document.querySelector('.modal-backdrop')) return;
    if (action === 'nova-folha') createPage();
    else if (action === 'novo-caderno') openNotebookModal();
    else if (action === 'nova-prova') openExamModal();
    else if (action === 'provas') showExams();
    else if (action === 'buscar') {
      $('search').focus();
      $('search').select();
    }
  });

  api.onFlush(async () => {
    await flushPages();
  });

  // Atualiza as contagens regressivas quando o dia vira.
  let lastDay = todayISO();
  setInterval(() => {
    if (todayISO() !== lastDay) {
      lastDay = todayISO();
      renderSidebar();
      if (state.view === 'exams') renderExams();
      else renderPagesCol();
    }
  }, 60_000);

  const config = await api.getConfig();
  state.version = config.version;

  await loadData();
  if (!state.notebooks.length && !config.welcomed) {
    try {
      await seedWelcome();
      selectNotebook(state.notebooks[0].id);
    } catch (err) {
      console.error(err);
    }
  }
}

if (!api) {
  document.body.textContent = 'O PlanNote precisa ser aberto pelo aplicativo (npm run dev).';
} else {
  start().catch((err) => {
    console.error(err);
    toast(`Não foi possível abrir seus cadernos. ${errMsg(err)}`, { error: true, ms: 10000 });
  });
}
