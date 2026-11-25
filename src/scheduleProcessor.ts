import { casarParticipantes, type Participante } from './matchParticipants';
import { avisarFormatoInvalido, avisarNomes, enviarEscalas } from './notify';
import { parseSchedule, type Escala } from './parseSchedule';
import type { ArmazenamentoDeDescricao, FonteDoGrupo, Logger, Mensageiro } from './ports';

export interface DependenciasDoProcessador {
  grupo: FonteDoGrupo;
  armazenamento: ArmazenamentoDeDescricao;
  mensageiro: Mensageiro;
  logger: Logger;
  pausarEntreEnvios: () => Promise<void>;
}

export interface ProcessadorDeEscala {
  /** Lê a descrição do grupo e, se ela mudou desde a última vez, envia as escalas. */
  processarSeDescricaoMudou(): Promise<void>;
}

export function criarProcessadorDeEscala(dependencias: DependenciasDoProcessador): ProcessadorDeEscala {
  const { grupo, armazenamento, mensageiro, logger, pausarEntreEnvios } = dependencias;

  async function processarSeDescricaoMudou(): Promise<void> {
    const dados = await grupo.carregarDados();
    const descricao = normalizarDescricao(dados.descricao);
    if (armazenamento.ler() === descricao) return;

    // Salva antes de enviar: se algo falhar no meio, ninguém recebe a escala duas vezes.
    armazenamento.salvar(descricao);
    if (descricao === '') return;

    logger.info('A descrição do grupo mudou. Lendo a escala...');
    await processarDescricao(descricao, dados.participantes);
  }

  async function processarDescricao(descricao: string, participantes: Participante[]): Promise<void> {
    const resultado = parseSchedule(descricao);

    if (!resultado.ok) {
      logger.info('A descrição não segue o formato. Avisando no grupo.');
      await avisarFormatoInvalido(mensageiro, logger, resultado.erros);
      return;
    }

    await enviarParaOsEscalados(resultado.escala, participantes);
  }

  async function enviarParaOsEscalados(escala: Escala, participantes: Participante[]): Promise<void> {
    const casamento = casarParticipantes(escala.pessoas, participantes);
    const { enviados, falhas } = await enviarEscalas({ mensageiro, logger, pausarEntreEnvios }, escala, casamento);
    await avisarNomes(mensageiro, logger, casamento);

    logger.info(
      `Escala ${escala.mes}: ${enviados} envio(s), ${falhas} falha(s), ` +
        `${casamento.naoEncontrados.length} nome(s) não encontrado(s) e ${casamento.ambiguos.length} repetido(s).`,
    );
  }

  return { processarSeDescricaoMudou };
}

/** Quebras de linha do Windows e espaços nas pontas não contam como mudança. */
function normalizarDescricao(descricao: string): string {
  return descricao.replace(/\r\n/g, '\n').trim();
}
