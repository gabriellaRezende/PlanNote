// Busca que ignora acentos e maiúsculas: "funcao" encontra "Função".

export function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Mesma ideia de normalize, mas mantendo o mesmo comprimento do texto original,
// para conseguirmos recortar o trecho certo e destacar a palavra encontrada.
export function fold(text) {
  let out = '';
  for (const unit of (text || '').split('')) {
    const n = normalize(unit);
    out += n.length ? n[0] : ' ';
  }
  return out;
}

/** Trecho em volta da primeira ocorrência: { before, match, after } ou null. */
export function snippet(text, query, radius = 48) {
  const q = normalize(query).trim();
  if (!q) return null;
  const folded = fold(text);
  const idx = folded.indexOf(q);
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, idx).replace(/\s+/g, ' ').trimStart(),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : ''),
  };
}

/**
 * Procura em todas as folhas. Cada item: { notebook, page, text }.
 * Todas as palavras da busca precisam aparecer (no título ou no texto).
 * Título vale mais que texto; empate: mais recente primeiro.
 */
export function searchPages(items, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const results = [];
  for (const item of items) {
    const title = normalize(item.page.title);
    const body = normalize(item.text);
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (body.includes(w)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) results.push({ ...item, score });
  }
  results.sort((a, b) => b.score - a.score || (b.page.updatedAt || '').localeCompare(a.page.updatedAt || ''));
  return results;
}
