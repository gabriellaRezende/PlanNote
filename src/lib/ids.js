// Identificadores únicos para cadernos, folhas e provas (também viram nomes de arquivo).
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const rand = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${rand()}-${rand()}`;
}

// Cores de capa disponíveis (os tons ficam em styles/theme.css).
export const COVERS = [
  { id: 'azul', label: 'Azul' },
  { id: 'vermelho', label: 'Vermelho' },
  { id: 'verde', label: 'Verde' },
  { id: 'amarelo', label: 'Amarelo' },
  { id: 'roxo', label: 'Roxo' },
  { id: 'laranja', label: 'Laranja' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'grafite', label: 'Grafite' },
];

export function coverVar(color) {
  const known = COVERS.some((c) => c.id === color);
  return `var(--cover-${known ? color : 'azul'})`;
}
