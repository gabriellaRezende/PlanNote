// Janelas de diálogo do app (no lugar de alert/confirm).
import { h } from './lib/dom.js';

let current = null;

/**
 * openModal({ title, body, actions })
 * actions: [{ label, kind: 'primary'|'danger'|'ghost', left?, onClick(close) }]
 * Enter num campo aciona a ação principal; Esc fecha.
 */
export function openModal({ title, body, actions = [], onClose }) {
  closeModal();
  const previousFocus = document.activeElement;

  const close = () => {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    current = null;
    onClose?.();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };

  const primary = actions.find((a) => a.kind === 'primary');

  const buttons = actions.map((a) =>
    h(
      'button',
      {
        type: 'button',
        class: `btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : ''} ${a.left ? 'left' : ''}`,
        onClick: () => a.onClick(close),
      },
      a.label,
    ),
  );

  const dialog = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', {}, title),
    h('div', { class: 'modal-body' }, body),
    buttons.length ? h('div', { class: 'modal-actions' }, buttons) : null,
  );

  const backdrop = h('div', {
    class: 'modal-backdrop',
    onMousedown: (ev) => {
      if (ev.target === backdrop) close();
    },
  });
  backdrop.append(dialog);

  function onKey(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close();
    } else if (ev.key === 'Enter' && primary && ev.target.tagName === 'INPUT') {
      ev.preventDefault();
      primary.onClick(close);
    } else if (ev.key === 'Tab') {
      // Mantém o foco dentro da janela.
      const focusables = dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  current = close;

  const firstField = dialog.querySelector('input:not([type="radio"]), select, textarea');
  (firstField || dialog.querySelector('.btn-primary') || dialog.querySelector('button'))?.focus();
  if (firstField?.select && firstField.type === 'text') firstField.select();

  return close;
}

export function closeModal() {
  if (current) current();
}

export function confirmModal({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      body: h('p', {}, message),
      actions: [
        { label: 'Cancelar', onClick: (close) => close() },
        {
          label: confirmLabel,
          kind: danger ? 'danger' : 'primary',
          onClick: (close) => {
            answered = true;
            close();
          },
        },
      ],
      onClose: () => resolve(answered),
    });
  });
}

let toastTimer = null;
export function toast(message, { error = false, ms = 3200 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: `toast ${error ? 'error' : ''}`, role: 'status' }, message);
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), ms);
}
