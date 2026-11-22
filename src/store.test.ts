import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { criarArmazenamentoEmArquivo } from './store';

let pasta: string;

before(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-store-'));
});

after(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('devolve undefined enquanto nada foi salvo', () => {
  const armazenamento = criarArmazenamentoEmArquivo(path.join(pasta, 'vazio', 'registro.json'), 'grupo@g.us');

  assert.equal(armazenamento.ler(), undefined);
});

test('guarda e devolve o último texto, criando a pasta se preciso', () => {
  const arquivo = path.join(pasta, 'novo', 'registro.json');
  const armazenamento = criarArmazenamentoEmArquivo(arquivo, 'grupo@g.us');

  armazenamento.salvar('ESCALA 11/2026');

  assert.equal(armazenamento.ler(), 'ESCALA 11/2026');
});

test('distingue o texto vazio de "nunca salvo"', () => {
  const armazenamento = criarArmazenamentoEmArquivo(path.join(pasta, 'vazia.json'), 'grupo@g.us');

  armazenamento.salvar('');

  assert.equal(armazenamento.ler(), '');
});

test('mantém um registro por grupo no mesmo arquivo', () => {
  const arquivo = path.join(pasta, 'dois-grupos.json');
  const primeiro = criarArmazenamentoEmArquivo(arquivo, 'um@g.us');
  const segundo = criarArmazenamentoEmArquivo(arquivo, 'dois@g.us');

  primeiro.salvar('texto do primeiro');
  segundo.salvar('texto do segundo');

  assert.equal(primeiro.ler(), 'texto do primeiro');
  assert.equal(segundo.ler(), 'texto do segundo');
});

test('ignora um arquivo ilegível e recomeça do zero', () => {
  const arquivo = path.join(pasta, 'quebrado.json');
  fs.writeFileSync(arquivo, '{ isto não é json', 'utf8');
  const armazenamento = criarArmazenamentoEmArquivo(arquivo, 'grupo@g.us');

  assert.equal(armazenamento.ler(), undefined);
});
