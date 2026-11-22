import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioDeNomes } from './contactNames';
import {
  ErroDeGrupo,
  localizarGrupo,
  montarParticipantes,
  type ParticipanteDoGrupo,
  type SocketDeGrupo,
} from './whatsappGroup';

function socketComGrupos(assuntos: string[]): SocketDeGrupo {
  const grupos = Object.fromEntries(assuntos.map((subject, i) => [`${i}@g.us`, { id: `${i}@g.us`, subject }]));

  return {
    groupFetchAllParticipating: async () => grupos,
    groupMetadata: async () => ({ participants: [] }),
    sendMessage: async () => undefined,
  };
}

test('localiza o grupo pelo nome, sem diferenciar acento ou caixa', async () => {
  const socket = socketComGrupos(['Família', 'Ministério de Louvor']);

  assert.equal(await localizarGrupo(socket, 'ministerio de louvor'), '1@g.us');
});

test('quando não há grupo com o nome, lista os grupos disponíveis', async () => {
  const socket = socketComGrupos(['Família', 'Trabalho']);

  await assert.rejects(
    () => localizarGrupo(socket, 'Louvor'),
    (erro: unknown) => {
      assert.ok(erro instanceof ErroDeGrupo);
      assert.match(erro.message, /Não encontrei nenhum grupo chamado "Louvor"/);
      assert.match(erro.message, /- Família/);
      assert.match(erro.message, /- Trabalho/);
      return true;
    },
  );
});

test('recusa nomes que correspondem a mais de um grupo', async () => {
  const socket = socketComGrupos(['Louvor', 'louvor']);

  await assert.rejects(() => localizarGrupo(socket, 'Louvor'), /mais de um grupo/);
});

test('os participantes não incluem o próprio bot', () => {
  const diretorio = criarDiretorioDeNomes();
  const lista: ParticipanteDoGrupo[] = [{ id: '5581900000000@s.whatsapp.net' }, { id: 'ana@s.whatsapp.net' }];

  const participantes = montarParticipantes({ id: '5581900000000:7@s.whatsapp.net' }, lista, diretorio);

  assert.deepEqual(
    participantes.map((p) => p.jid),
    ['ana@s.whatsapp.net'],
  );
});

test('prefere o número de telefone como destino e reúne os nomes de todos os ids', () => {
  const diretorio = criarDiretorioDeNomes();
  diretorio.registrarContato({ id: '999@lid', name: 'Ana' });
  diretorio.registrarContato({ id: '5581911111111@s.whatsapp.net', notify: 'Aninha' });

  const participantes = montarParticipantes(
    undefined,
    [{ id: '999@lid', phoneNumber: '5581911111111@s.whatsapp.net' }],
    diretorio,
  );

  assert.equal(participantes[0].jid, '5581911111111@s.whatsapp.net');
  assert.deepEqual([...participantes[0].nomes].sort(), ['Ana', 'Aninha']);
});
