import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioDeNomes } from '../domain/contactNames';
import { criarMonitorDeGrupo } from './groupMonitor';
import { loggerSilencioso } from '../adapters/system/logger';
import type { ArmazenamentoDeDescricao } from './ports';
import { ErroDeGrupo, type SocketDeGrupo } from '../adapters/whatsapp/whatsappGroup';

const ID_DO_BOT = '5581900000000:3@s.whatsapp.net';
const ANA = 'ana@s.whatsapp.net';

function montarCenario(nomesDosGrupos: string[]) {
  const enviadas: Array<{ jid: string; texto: string }> = [];
  const falhas: unknown[] = [];
  const registros = new Map<string, string>();
  let descricao = 'ESCALA 11/2026\n05/11 | Ana: voz';

  const socket: SocketDeGrupo = {
    user: { id: ID_DO_BOT },
    groupFetchAllParticipating: async () =>
      Object.fromEntries(nomesDosGrupos.map((subject, i) => [`${i}@g.us`, { id: `${i}@g.us`, subject }])),
    groupMetadata: async () => ({ desc: descricao, participants: [{ id: ANA }, { id: ID_DO_BOT }] }),
    sendMessage: async (jid, conteudo) => {
      enviadas.push({ jid, texto: conteudo.text });
    },
  };

  const diretorio = criarDiretorioDeNomes();
  diretorio.registrarContato({ id: ANA, name: 'Ana' });

  const monitor = criarMonitorDeGrupo({
    nomeGrupo: 'Louvor',
    diretorio,
    criarArmazenamento: (grupoJid): ArmazenamentoDeDescricao => ({
      ler: () => registros.get(grupoJid),
      salvar: (texto) => void registros.set(grupoJid, texto),
    }),
    logger: loggerSilencioso,
    pausarEntreEnvios: async () => {},
    aguardarSincronizacao: async () => {},
    aoFalhar: (erro) => void falhas.push(erro),
  });

  return { monitor, socket, enviadas, falhas, trocarDescricao: (texto: string) => void (descricao = texto) };
}

test('ao conectar, encontra o grupo e envia a escala', async () => {
  const { monitor, socket, enviadas } = montarCenario(['Família', 'Louvor']);

  monitor.aoConectar(socket);
  await monitor.aguardarConclusao();

  assert.deepEqual(enviadas, [{ jid: ANA, texto: 'Olá, Ana. Sua escala de 11/2026:\n• 05/11 — voz' }]);
});

test('reage à mudança da descrição do grupo monitorado', async () => {
  const { monitor, socket, enviadas, trocarDescricao } = montarCenario(['Louvor']);
  monitor.aoConectar(socket);
  await monitor.aguardarConclusao();

  trocarDescricao('ESCALA 12/2026\n03/12 | Ana: back');
  monitor.aoMudarDescricao('0@g.us');
  await monitor.aguardarConclusao();

  assert.equal(enviadas.length, 2);
  assert.match(enviadas[1].texto, /escala de 12\/2026/);
});

test('ignora mudanças de descrição de outros grupos', async () => {
  const { monitor, socket, enviadas, trocarDescricao } = montarCenario(['Louvor']);
  monitor.aoConectar(socket);
  await monitor.aguardarConclusao();

  trocarDescricao('ESCALA 12/2026\n03/12 | Ana: back');
  monitor.aoMudarDescricao('outro@g.us');
  await monitor.aguardarConclusao();

  assert.equal(enviadas.length, 1);
});

test('ignora mudanças de descrição antes de conectar', async () => {
  const { monitor, enviadas } = montarCenario(['Louvor']);

  monitor.aoMudarDescricao('0@g.us');
  await monitor.aguardarConclusao();

  assert.equal(enviadas.length, 0);
});

test('avisa a falha quando o grupo não existe', async () => {
  const { monitor, socket, enviadas, falhas } = montarCenario(['Família']);

  monitor.aoConectar(socket);
  await monitor.aguardarConclusao();

  assert.equal(enviadas.length, 0);
  assert.equal(falhas.length, 1);
  assert.ok(falhas[0] instanceof ErroDeGrupo);
});
