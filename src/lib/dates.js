// Datas sempre como texto "AAAA-MM-DD" no fuso local (provas não têm fuso).

const DAY_MS = 86400000;

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + n);
  return toISO(date);
}

// Dias de calendário entre duas datas (arredonda para ignorar horário de verão).
export function daysBetween(fromISO, toISOValue) {
  return Math.round((parseISO(toISOValue) - parseISO(fromISO)) / DAY_MS);
}

/**
 * Contagem regressiva de uma prova.
 * tone: "past" (já passou), "urgent" (até 3 dias), "soon" (até 7 dias), "later".
 */
export function countdown(dateISO, today = todayISO()) {
  const days = daysBetween(today, dateISO);
  let label;
  if (days === 0) label = 'Hoje';
  else if (days === 1) label = 'Amanhã';
  else if (days === -1) label = 'Ontem';
  else if (days > 1) label = `em ${days} dias`;
  else label = `há ${-days} dias`;

  let tone = 'later';
  if (days < 0) tone = 'past';
  else if (days <= 3) tone = 'urgent';
  else if (days <= 7) tone = 'soon';

  return { days, label, tone };
}

export function formatBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

// "qui., 12 de dez." → "qui · 12 dez"
export function formatShort(iso) {
  const date = parseISO(iso);
  const wd = weekdayFmt.format(date).replace('.', '');
  const dm = dayMonthFmt.format(date).replace(/\./g, '').replace(' de ', ' ');
  return `${wd} · ${dm}`;
}

export function formatDateTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';
  const today = todayISO();
  const day = toISO(date);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (day === today) return `hoje, ${time}`;
  if (day === addDays(today, -1)) return `ontem, ${time}`;
  return formatBR(day);
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export function monthLabel(year, monthIndex) {
  const text = monthFmt.format(new Date(year, monthIndex, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Grade do mês (6 semanas, começando no domingo, como no calendário brasileiro). */
export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ iso: toISO(date), day: date.getDate(), inMonth: date.getMonth() === monthIndex });
  }
  return days;
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
