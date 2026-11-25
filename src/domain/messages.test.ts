import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResultadoCasamento } from './matchParticipants';
import { montarAvisoFormato, montarAvisoNomes, montarMensagemPessoa } from './messages';
import type { PessoaEscala } from './parseSchedule';

const ana: PessoaEscala = {
  nome: 'Ana',
  chave: 'ana',
  itens: [
    { data: '05/11', funcao: 'voz' },
    { data: '12/11', funcao: 'back' },
  ],
};

function casamento(parcial: Partial<ResultadoCasamento>): ResultadoCasamento {
  return { encontrados: [], naoEncontrados: [], ambiguos: [], ...parcial };
}

test('monta o privado só com as datas da pessoa', () => {
  assert.equal(
    montarMensagemPessoa(ana, '11/2026'),
    ['Olá, Ana. Sua escala de 11/2026:', '• 05/11 — voz', '• 12/11 — back'].join('\n'),
  );
});

test('o aviso de formato lista os problemas e mostra o modelo', () => {
  const aviso = montarAvisoFormato(['Linha 2: "Ana som" não segue o modelo.']);

  assert.match(aviso, /• Linha 2/);
  assert.match(aviso, /Modelo:\nESCALA DEZEMBRO 2026/);
});

test('o aviso de formato limita a quantidade de problemas mostrados', () => {
  const erros = Array.from({ length: 8 }, (_, i) => `problema ${i + 1}`);
  const aviso = montarAvisoFormato(erros);

  assert.match(aviso, /problema 5/);
  assert.doesNotMatch(aviso, /problema 6/);
  assert.match(aviso, /e mais 3 problema\(s\)/);
});

test('não há aviso de nomes quando todos foram encontrados', () => {
  assert.equal(montarAvisoNomes(casamento({})), null);
});

test('o aviso de nomes cita quem não foi encontrado e quem tem nome repetido', () => {
  const aviso = montarAvisoNomes(casamento({ naoEncontrados: ['Lucas'], ambiguos: ['Maria'] }));

  assert.match(aviso ?? '', /Não encontrei no grupo: Lucas/);
  assert.match(aviso ?? '', /Mais de uma pessoa com o nome: Maria/);
});
