import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggerSilencioso } from '../adapters/system/logger';
import type { Participante } from '../domain/matchParticipants';
import type { ArmazenamentoDeDescricao, Mensageiro } from './ports';
import { criarProcessadorDeEscala } from './scheduleProcessor';

const DESCRICAO = 'ESCALA 11/2026\n05/11 | Ana: voz; Lucas: bateria\n12/11 | Ana: back';

const ANA = 'ana@s.whatsapp.net';
const LUCAS = 'lucas@s.whatsapp.net';

const PARTICIPANTES: Participante[] = [
  { jid: ANA, nomes: ['Ana'] },
  { jid: LUCAS, nomes: ['Lucas'] },
];

interface OpcoesDoCenario {
  descricaoDoGrupo: string;
  participantes?: Participante[];
  descricaoSalva?: string;
  jidQueFalha?: string;
}

function montarCenario(opcoes: OpcoesDoCenario) {
  const privados: Array<{ jid: string; texto: string }> = [];
  const avisos: string[] = [];
  let descricaoSalva = opcoes.descricaoSalva;

  const mensageiro: Mensageiro = {
    async enviarPrivado(jid, texto) {
      if (jid === opcoes.jidQueFalha) throw new Error('falha simulada');
      privados.push({ jid, texto });
    },
    async avisarGrupo(texto) {
      avisos.push(texto);
    },
  };

  const armazenamento: ArmazenamentoDeDescricao = {
    ler: () => descricaoSalva,
    salvar: (descricao) => {
      descricaoSalva = descricao;
    },
  };

  const processador = criarProcessadorDeEscala({
    grupo: {
      carregarDados: async () => ({
        descricao: opcoes.descricaoDoGrupo,
        participantes: opcoes.participantes ?? PARTICIPANTES,
      }),
    },
    armazenamento,
    mensageiro,
    logger: loggerSilencioso,
    pausarEntreEnvios: async () => {},
  });

  return { processador, privados, avisos, descricaoSalva: () => descricaoSalva };
}

test('envia a cada pessoa só a sua parte da escala', async () => {
  const { processador, privados } = montarCenario({ descricaoDoGrupo: DESCRICAO });

  await processador.processarSeDescricaoMudou();

  const paraAna = privados.find((privado) => privado.jid === ANA);
  const paraLucas = privados.find((privado) => privado.jid === LUCAS);
  assert.equal(paraAna?.texto, 'Olá, Ana. Sua escala de 11/2026:\n• 05/11 — voz\n• 12/11 — back');
  assert.equal(paraLucas?.texto, 'Olá, Lucas. Sua escala de 11/2026:\n• 05/11 — bateria');
});

test('guarda a descrição processada', async () => {
  const { processador, descricaoSalva } = montarCenario({ descricaoDoGrupo: DESCRICAO });

  await processador.processarSeDescricaoMudou();

  assert.equal(descricaoSalva(), DESCRICAO);
});

test('não reenvia quando a descrição não mudou', async () => {
  const { processador, privados, avisos } = montarCenario({
    descricaoDoGrupo: DESCRICAO,
    descricaoSalva: DESCRICAO,
  });

  await processador.processarSeDescricaoMudou();

  assert.equal(privados.length, 0);
  assert.equal(avisos.length, 0);
});

test('quebras de linha do Windows não contam como mudança', async () => {
  const { processador, privados } = montarCenario({
    descricaoDoGrupo: DESCRICAO.replace(/\n/g, '\r\n'),
    descricaoSalva: DESCRICAO,
  });

  await processador.processarSeDescricaoMudou();

  assert.equal(privados.length, 0);
});

test('avisa no grupo quem não foi encontrado e envia aos demais', async () => {
  const { processador, privados, avisos } = montarCenario({
    descricaoDoGrupo: DESCRICAO,
    participantes: [{ jid: ANA, nomes: ['Ana'] }],
  });

  await processador.processarSeDescricaoMudou();

  assert.equal(privados.length, 1);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Lucas/);
});

test('descrição fora do formato: avisa uma vez no grupo e não envia privado', async () => {
  const { processador, privados, avisos } = montarCenario({ descricaoDoGrupo: 'Reunião toda quarta' });

  await processador.processarSeDescricaoMudou();
  await processador.processarSeDescricaoMudou();

  assert.equal(privados.length, 0);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Modelo:/);
});

test('descrição vazia é registrada e não envia nada', async () => {
  const { processador, privados, avisos, descricaoSalva } = montarCenario({ descricaoDoGrupo: '' });

  await processador.processarSeDescricaoMudou();

  assert.equal(descricaoSalva(), '');
  assert.equal(privados.length, 0);
  assert.equal(avisos.length, 0);
});

test('se o aviso no grupo falhar, não derruba o processamento e registra o texto', async () => {
  const erros: string[] = [];
  const processador = criarProcessadorDeEscala({
    grupo: {
      carregarDados: async () => ({ descricao: DESCRICAO, participantes: [{ jid: ANA, nomes: ['Ana'] }] }),
    },
    armazenamento: { ler: () => undefined, salvar: () => {} },
    mensageiro: {
      enviarPrivado: async () => {},
      avisarGrupo: async () => {
        throw new Error('No sessions');
      },
    },
    logger: { info: () => {}, erro: (mensagem) => void erros.push(mensagem) },
    pausarEntreEnvios: async () => {},
  });

  await processador.processarSeDescricaoMudou();

  assert.equal(erros.length, 1);
  assert.match(erros[0], /Falha ao enviar o aviso no grupo/);
  assert.match(erros[0], /Lucas/);
});

test('a falha com uma pessoa não impede as outras de receberem', async () => {
  const { processador, privados } = montarCenario({ descricaoDoGrupo: DESCRICAO, jidQueFalha: ANA });

  await processador.processarSeDescricaoMudou();

  assert.deepEqual(
    privados.map((privado) => privado.jid),
    [LUCAS],
  );
});
