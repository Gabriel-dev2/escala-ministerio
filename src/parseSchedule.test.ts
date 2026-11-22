import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarNome, parseSchedule } from './parseSchedule';

const EXEMPLO = `ESCALA 11/2026
05/11 | Ana: voz; João: teclado; Lucas: bateria
12/11 | Ana: back; Maria: voz`;

test('agrupa a escala por pessoa', () => {
  const resultado = parseSchedule(EXEMPLO);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.mes, '11/2026');
  assert.deepEqual(
    resultado.escala.pessoas.map((p) => p.nome),
    ['Ana', 'João', 'Lucas', 'Maria'],
  );

  const ana = resultado.escala.pessoas.find((p) => p.nome === 'Ana');
  assert.deepEqual(ana?.itens, [
    { data: '05/11', funcao: 'voz' },
    { data: '12/11', funcao: 'back' },
  ]);
});

test('trata "Joao" e "João" como a mesma pessoa', () => {
  const resultado = parseSchedule('ESCALA 11/2026\n05/11 | João: teclado\n12/11 | joao: violão');
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.equal(resultado.escala.pessoas.length, 1);
  assert.equal(resultado.escala.pessoas[0].itens.length, 2);
});

test('aceita linhas em branco, quebras do Windows, ponto e vírgula final e datas sem zero', () => {
  const resultado = parseSchedule('ESCALA 11/2026\r\n\r\n5/11 | Ana: voz;\r\n');
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;

  assert.deepEqual(resultado.escala.pessoas[0].itens, [{ data: '05/11', funcao: 'voz' }]);
});

test('rejeita descrição vazia', () => {
  const resultado = parseSchedule('   \n  ');
  assert.equal(resultado.ok, false);
});

test('rejeita título fora do modelo', () => {
  const resultado = parseSchedule('Escala de novembro\n05/11 | Ana: voz');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /título/);
});

test('aponta a linha que não segue "data | Nome: função"', () => {
  const resultado = parseSchedule('ESCALA 11/2026\n05/11 | Ana: voz\nDomingo: Ana e João');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.equal(resultado.erros.length, 1);
  assert.match(resultado.erros[0], /Linha 3/);
});

test('aponta pessoa sem função', () => {
  const resultado = parseSchedule('ESCALA 11/2026\n05/11 | Ana: voz; João');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /João/);
});

test('rejeita data que não existe', () => {
  const resultado = parseSchedule('ESCALA 02/2026\n30/02 | Ana: voz');
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;

  assert.match(resultado.erros[0], /não existe/);
});

test('rejeita título sem nenhuma data', () => {
  const resultado = parseSchedule('ESCALA 11/2026');
  assert.equal(resultado.ok, false);
});

test('normalizarNome remove acento, caixa e espaços repetidos', () => {
  assert.equal(normalizarNome('  JOÃO   Pedro '), 'joao pedro');
});
