import type { Encontrado, ResultadoCasamento } from './matchParticipants';
import { montarAvisoFormato, montarAvisoNomes, montarMensagemPessoa } from './messages';
import type { Escala } from './parseSchedule';
import type { Logger, Mensageiro } from './ports';
import { esperar } from './timing';

const PAUSA_MINIMA_MS = 3000;
const PAUSA_VARIAVEL_MS = 4000;

export interface ContextoDeEnvio {
  mensageiro: Mensageiro;
  logger: Logger;
  pausarEntreEnvios: () => Promise<void>;
}

export interface ResumoDeEnvio {
  enviados: number;
  falhas: number;
}

/** Pausa aleatória entre os privados, para não enviar tudo de uma vez. */
export function pausaAleatoriaEntreEnvios(): Promise<void> {
  return esperar(PAUSA_MINIMA_MS + Math.random() * PAUSA_VARIAVEL_MS);
}

/** Envia no privado só as datas de cada pessoa encontrada, uma de cada vez. */
export async function enviarEscalas(
  contexto: ContextoDeEnvio,
  escala: Escala,
  casamento: ResultadoCasamento,
): Promise<ResumoDeEnvio> {
  const resumo: ResumoDeEnvio = { enviados: 0, falhas: 0 };

  for (const [indice, destinatario] of casamento.encontrados.entries()) {
    if (indice > 0) await contexto.pausarEntreEnvios();

    const enviou = await tentarEnviar(contexto, destinatario, escala.mes);
    if (enviou) resumo.enviados++;
    else resumo.falhas++;
  }

  return resumo;
}

export function avisarFormatoInvalido(mensageiro: Mensageiro, erros: string[]): Promise<void> {
  return mensageiro.avisarGrupo(montarAvisoFormato(erros));
}

export async function avisarNomes(mensageiro: Mensageiro, casamento: ResultadoCasamento): Promise<void> {
  const aviso = montarAvisoNomes(casamento);
  if (aviso) await mensageiro.avisarGrupo(aviso);
}

/** Uma falha não pode impedir que as demais pessoas recebam a escala. */
async function tentarEnviar(
  { mensageiro, logger }: ContextoDeEnvio,
  { pessoa, jid }: Encontrado,
  mes: string,
): Promise<boolean> {
  try {
    await mensageiro.enviarPrivado(jid, montarMensagemPessoa(pessoa, mes));
    return true;
  } catch (erro) {
    logger.erro(`Falha ao enviar a escala de ${pessoa.nome}:`, erro);
    return false;
  }
}
