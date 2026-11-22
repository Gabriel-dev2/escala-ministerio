import assert from 'node:assert/strict';
import { test } from 'node:test';
import { casarParticipantes, type Participante } from './matchParticipants';
import type { PessoaEscala } from './parseSchedule';

function pessoa(nome: string): PessoaEscala {
  const chave = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return { nome, chave, itens: [{ data: '05/11', funcao: 'voz' }] };
}

const participantes: Participante[] = [
  { jid: '5581911111111@s.whatsapp.net', nomes: ['Ana'] },
  { jid: '5581922222222@s.whatsapp.net', nomes: ['João', 'Joao P.'] },
  { jid: '5581933333333@s.whatsapp.net', nomes: ['Maria'] },
  { jid: '5581944444444@s.whatsapp.net', nomes: ['Maria'] },
];

test('encontra pelo nome sem diferenciar acento ou caixa', () => {
  const resultado = casarParticipantes([pessoa('Ana'), pessoa('Joao')], participantes);

  assert.deepEqual(
    resultado.encontrados.map((e) => e.jid),
    ['5581911111111@s.whatsapp.net', '5581922222222@s.whatsapp.net'],
  );
  assert.deepEqual(resultado.naoEncontrados, []);
});

test('lista quem não foi encontrado no grupo', () => {
  const resultado = casarParticipantes([pessoa('Lucas')], participantes);

  assert.deepEqual(resultado.encontrados, []);
  assert.deepEqual(resultado.naoEncontrados, ['Lucas']);
});

test('não envia quando o nome bate com mais de uma pessoa', () => {
  const resultado = casarParticipantes([pessoa('Maria')], participantes);

  assert.deepEqual(resultado.encontrados, []);
  assert.deepEqual(resultado.ambiguos, ['Maria']);
});
