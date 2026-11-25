import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarNome, parseSchedule } from './parseSchedule';

const EXEMPLO = [
  'ESCALA DEZEMBRO 2026',
  '',
  '02/12 (QUARTA-FEIRA).',
  '- Transmissão YouTube e som: Flávio.',
  '- Projeção Slide: Natali.',
  '',
  '06/12 (DOMINGO) - Manhã.',
  '- Transmissão YouTube: Gabriel F.',
  '- Projeção Slide: Lorena.',
  '- Som: Guilheme.',
  '06/12 (DOMINGO) - Noite.',
  '- Transmissão YouTube: Gabriel L.',
  '- Projeção Slide: Lorena.',
  '- Som: Guilheme.',
].join('\n');

test('agrupa a escala por pessoa', () => {
  const resultado = parseSchedule(EXEMPLO);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.mes, '12/2026');
  assert.equal(resultado.escala.titulo, 'ESCALA DEZEMBRO 2026');

  const nomes = resultado.escala.pessoas.map((p) => p.nome);
  assert.ok(nomes.includes('Flávio'));
  assert.ok(nomes.includes('Natali'));
  assert.ok(nomes.includes('Gabriel F'));
  assert.ok(nomes.includes('Lorena'));
  assert.ok(nomes.includes('Guilheme'));
  assert.ok(nomes.includes('Gabriel L'));
});

test('distingue Manhã e Noite no rótulo da data', () => {
  const resultado = parseSchedule(EXEMPLO);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  const lorena = resultado.escala.pessoas.find((p) => p.nome === 'Lorena');
  assert.deepEqual(lorena?.itens, [
    { data: '06/12 — Manhã', funcao: 'Projeção Slide' },
    { data: '06/12 — Noite', funcao: 'Projeção Slide' },
  ]);
});

test('data sem sufixo mostra apenas dd/mm', () => {
  const resultado = parseSchedule(EXEMPLO);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  const flavio = resultado.escala.pessoas.find((p) => p.nome === 'Flávio');
  assert.deepEqual(flavio?.itens, [
    { data: '02/12', funcao: 'Transmissão YouTube e som' },
  ]);
});

test('separa nomes com barra (Davi/Thiago) em duas designações', () => {
  const descricao = [
    'ESCALA DEZEMBRO 2026',
    '13/12 (DOMINGO) - Manhã.',
    '- Transmissão YouTube: Davi/Thiago.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.pessoas.length, 2);
  const nomes = resultado.escala.pessoas.map((p) => p.nome).sort();
  assert.deepEqual(nomes, ['Davi', 'Thiago']);
});

test('trata nome sem acento como a mesma pessoa', () => {
  const descricao = [
    'ESCALA DEZEMBRO 2026',
    '02/12 (QUARTA-FEIRA).',
    '- Som: Flávio.',
    '06/12 (DOMINGO) - Manhã.',
    '- Som: flavio.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.pessoas.length, 1);
  assert.equal(resultado.escala.pessoas[0].itens.length, 2);
});

test('aceita linhas em branco e quebras do Windows', () => {
  const descricao = 'ESCALA DEZEMBRO 2026\r\n\r\n2/12 (QUARTA-FEIRA).\r\n- Som: Ana.\r\n';
  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.deepEqual(resultado.escala.pessoas[0].itens, [{ data: '02/12', funcao: 'Som' }]);
});

test('aceita sufixo de evento especial na data', () => {
  const descricao = [
    'ESCALA DEZEMBRO 2026',
    '12/12 (SÁBADO)  - ENCONTRO DE JOVENS',
    '- Transmissão YouTube: Moézio.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.deepEqual(resultado.escala.pessoas[0].itens, [
    { data: '12/12 — ENCONTRO DE JOVENS', funcao: 'Transmissão YouTube' },
  ]);
});

test('rejeita descrição vazia', () => {
  const resultado = parseSchedule('   \n  ');
  assert.equal(resultado.ok, false);
});

test('rejeita título fora do modelo', () => {
  const resultado = parseSchedule('Escala de novembro\n02/11 (DOMINGO).\n- Som: Ana.');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /título/);
});

test('rejeita mês inválido no título', () => {
  const resultado = parseSchedule('ESCALA TREZE 2026\n02/11 (DOMINGO).\n- Som: Ana.');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /desconhecido/i);
});

test('aponta linha de designação sem o modelo "Função: Nome"', () => {
  const descricao = [
    'ESCALA DEZEMBRO 2026',
    '02/12 (QUARTA-FEIRA).',
    '- Ana som',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /Linha 3/);
});

test('rejeita data que não existe', () => {
  const descricao = [
    'ESCALA FEVEREIRO 2026',
    '30/02 (SEGUNDA).',
    '- Som: Ana.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /não existe/);
});

test('rejeita título sem nenhuma data', () => {
  const resultado = parseSchedule('ESCALA DEZEMBRO 2026');
  assert.equal(resultado.ok, false);
});

test('normalizarNome remove acento, caixa e espaços repetidos', () => {
  assert.equal(normalizarNome('  JOÃO   Pedro '), 'joao pedro');
});

test('aceita título com mês março (com e sem acento)', () => {
  for (const nome of ['MARÇO', 'MARCO', 'março', 'marco']) {
    const resultado = parseSchedule(`ESCALA ${nome} 2026\n01/03 (DOMINGO).\n- Som: Ana.`);
    assert.equal(resultado.ok, true, `falhou com "${nome}"`);
  }
});

test('tira o ponto final do nome da pessoa', () => {
  const descricao = [
    'ESCALA DEZEMBRO 2026',
    '02/12 (QUARTA-FEIRA).',
    '- Projeção Slide: Maria Cybelle.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.pessoas[0].nome, 'Maria Cybelle');
});

test('aceita ponto no título e marcadores automáticos do WhatsApp (•⁠  ⁠ e –)', () => {
  const descricao = [
    'ESCALA NOVEMBRO 2026.',
    '',
    '01/11 (DOMINGO) – Manhã.',
    '•\u2060  \u2060Transmissão YouTube: Daniel/Gabriel Lucas.',
    '•\u2060  \u2060Projeção Slide: Lorena.',
    '•\u2060  \u2060Som: Guilherme.',
    '04/11 (QUARTA-FEIRA).',
    '•\u2060  \u2060Transmissão YouTube e som: Gabriel L.',
  ].join('\n');

  const resultado = parseSchedule(descricao);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.mes, '11/2026');
  const daniel = resultado.escala.pessoas.find((p) => p.nome === 'Daniel');
  const gabrielLucas = resultado.escala.pessoas.find((p) => p.nome === 'Gabriel Lucas');
  const gabrielL = resultado.escala.pessoas.find((p) => p.nome === 'Gabriel L');
  assert.deepEqual(daniel?.itens, [{ data: '01/11 — Manhã', funcao: 'Transmissão YouTube' }]);
  assert.deepEqual(gabrielLucas?.itens, [{ data: '01/11 — Manhã', funcao: 'Transmissão YouTube' }]);
  assert.deepEqual(gabrielL?.itens, [{ data: '04/11', funcao: 'Transmissão YouTube e som' }]);
});
