// Editor rico da folha (TipTap). Um editor novo é criado a cada folha aberta,
// assim o "desfazer" nunca volta para o texto de outra folha.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { h, icon } from './lib/dom.js';

const isMac = window.plannote?.platform === 'darwin';
const mod = isMac ? '⌘' : 'Ctrl+';
const shift = isMac ? '⇧' : 'Shift+';

const TOOLS = [
  { id: 'h2', text: 'T', title: 'Título', run: (c) => c.toggleHeading({ level: 2 }), active: (e) => e.isActive('heading', { level: 2 }) },
  { id: 'h3', text: 't', title: 'Subtítulo', run: (c) => c.toggleHeading({ level: 3 }), active: (e) => e.isActive('heading', { level: 3 }) },
  'sep',
  { id: 'bold', text: 'B', title: `Negrito (${mod}B)`, run: (c) => c.toggleBold(), active: (e) => e.isActive('bold') },
  { id: 'italic', text: 'I', title: `Itálico (${mod}I)`, run: (c) => c.toggleItalic(), active: (e) => e.isActive('italic'), style: 'font-style: italic; font-family: Georgia, serif' },
  { id: 'underline', text: 'U', title: `Sublinhado (${mod}U)`, run: (c) => c.toggleUnderline(), active: (e) => e.isActive('underline'), style: 'text-decoration: underline' },
  { id: 'highlight', icon: 'highlight', title: `Marca-texto (${mod}${shift}H)`, run: (c) => c.toggleHighlight(), active: (e) => e.isActive('highlight') },
  'sep',
  { id: 'bullet', icon: 'bulletList', title: 'Lista', run: (c) => c.toggleBulletList(), active: (e) => e.isActive('bulletList') },
  { id: 'ordered', icon: 'orderedList', title: 'Lista numerada', run: (c) => c.toggleOrderedList(), active: (e) => e.isActive('orderedList') },
  { id: 'task', icon: 'taskList', title: 'Checklist', run: (c) => c.toggleTaskList(), active: (e) => e.isActive('taskList') },
  { id: 'quote', icon: 'quote', title: 'Citação', run: (c) => c.toggleBlockquote(), active: (e) => e.isActive('blockquote') },
  { id: 'hr', icon: 'divider', title: 'Linha divisória', run: (c) => c.setHorizontalRule() },
  'sep',
  { id: 'undo', icon: 'undo', title: `Desfazer (${mod}Z)`, run: (c) => c.undo(), enabled: (e) => e.can().undo() },
  { id: 'redo', icon: 'redo', title: `Refazer (${mod}${shift}Z)`, run: (c) => c.redo(), enabled: (e) => e.can().redo() },
];

/** Monta os botões da barra de ferramentas uma vez. Devolve a função que os atualiza. */
export function buildToolbar(container, getEditor) {
  const buttons = [];
  for (const tool of TOOLS) {
    if (tool === 'sep') {
      container.append(h('span', { class: 'sep', 'aria-hidden': 'true' }));
      continue;
    }
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'tb-btn',
        title: tool.title,
        'aria-label': tool.title,
        // Não tira o foco do texto ao clicar.
        onMousedown: (ev) => ev.preventDefault(),
        onClick: () => {
          const editor = getEditor();
          if (!editor) return;
          tool.run(editor.chain().focus()).run();
        },
      },
      tool.icon ? icon(tool.icon) : tool.text,
    );
    if (tool.style) btn.setAttribute('style', tool.style);
    container.append(btn);
    buttons.push({ tool, btn });
  }

  return function refresh() {
    const editor = getEditor();
    for (const { tool, btn } of buttons) {
      const on = Boolean(editor && tool.active && tool.active(editor));
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.disabled = !editor || (tool.enabled ? !tool.enabled(editor) : false);
    }
  };
}

export function mountEditor(element, html, { onChange, onState }) {
  return new Editor({
    element,
    content: html || '',
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Comece a escrever…' }),
    ],
    editorProps: {
      attributes: { spellcheck: 'true', 'aria-label': 'Conteúdo da folha' },
    },
    onUpdate: ({ editor }) => onChange(editor),
    onTransaction: () => onState(),
    onFocus: () => onState(),
    onBlur: () => onState(),
  });
}
