import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, countdown, daysBetween, formatBR, monthGrid } from '../src/lib/dates.js';

test('contagem regressiva: hoje, amanhã, dias e passado', () => {
  assert.deepEqual(countdown('2026-11-26', '2026-11-26'), { days: 0, label: 'Hoje', tone: 'urgent' });
  assert.equal(countdown('2026-11-27', '2026-11-26').label, 'Amanhã');
  assert.deepEqual(countdown('2026-12-01', '2026-11-26'), { days: 5, label: 'em 5 dias', tone: 'soon' });
  assert.equal(countdown('2026-12-20', '2026-11-26').tone, 'later');
  assert.deepEqual(countdown('2026-11-20', '2026-11-26'), { days: -6, label: 'há 6 dias', tone: 'past' });
  assert.equal(countdown('2026-11-25', '2026-11-26').label, 'Ontem');
});

test('dias entre datas atravessando mudança de mês e de ano', () => {
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2027-02-27', '2027-03-01'), 2);
  assert.equal(addDays('2026-11-26', 10), '2026-12-06');
});

test('formato brasileiro da data', () => {
  assert.equal(formatBR('2026-12-07'), '07/12/2026');
});

test('grade do mês começa no domingo e cobre o mês inteiro', () => {
  const days = monthGrid(2026, 10); // novembro de 2026 começa num domingo
  assert.equal(days.length, 42);
  assert.equal(days[0].iso, '2026-11-01');
  assert.equal(days.filter((d) => d.inMonth).length, 30);

  const dec = monthGrid(2026, 11); // dezembro de 2026 começa numa terça
  assert.equal(dec[0].iso, '2026-11-29');
  assert.equal(dec[2].iso, '2026-12-01');
});
