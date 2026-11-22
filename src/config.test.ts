import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carregarConfiguracao } from './config';

test('lê o nome do grupo sem espaços nas pontas', () => {
  const configuracao = carregarConfiguracao({ GROUP_NAME: '  Ministério de Louvor ' });

  assert.equal(configuracao.nomeGrupo, 'Ministério de Louvor');
});

test('falha quando GROUP_NAME não foi definido', () => {
  assert.throws(() => carregarConfiguracao({}), /GROUP_NAME/);
});

test('falha quando GROUP_NAME está em branco', () => {
  assert.throws(() => carregarConfiguracao({ GROUP_NAME: '   ' }), /GROUP_NAME/);
});
