import type { ContatoConhecido, DiretorioDeNomes } from '../../domain/contactNames';
import type { Participante } from '../../domain/matchParticipants';
import { normalizarNome } from '../../domain/parseSchedule';
import type { DadosDoGrupo, FonteDoGrupo, Mensageiro } from '../../application/ports';

export interface ParticipanteDoGrupo {
  id: string;
  lid?: string;
  phoneNumber?: string;
}

/** O mínimo que precisamos do socket do WhatsApp para trabalhar com o grupo. */
export interface SocketDeGrupo {
  user?: ContatoConhecido;
  groupFetchAllParticipating(): Promise<Record<string, { id: string; subject: string }>>;
  groupMetadata(jid: string): Promise<{ desc?: string; participants: ParticipanteDoGrupo[] }>;
  sendMessage(jid: string, conteudo: { text: string }): Promise<unknown>;
}

export class ErroDeGrupo extends Error {}

export async function localizarGrupo(socket: SocketDeGrupo, nomeGrupo: string): Promise<string> {
  const grupos = Object.values(await socket.groupFetchAllParticipating());
  const procurado = normalizarNome(nomeGrupo);
  const correspondentes = grupos.filter((grupo) => normalizarNome(grupo.subject) === procurado);

  if (correspondentes.length === 1) return correspondentes[0].id;

  const assuntos = grupos.map((grupo) => grupo.subject);
  throw new ErroDeGrupo(explicarGrupoNaoLocalizado(nomeGrupo, correspondentes.length, assuntos));
}

export function criarFonteDoGrupo(
  socket: SocketDeGrupo,
  grupoJid: string,
  diretorio: DiretorioDeNomes,
): FonteDoGrupo {
  return {
    async carregarDados(): Promise<DadosDoGrupo> {
      const metadados = await socket.groupMetadata(grupoJid);
      return {
        descricao: metadados.desc ?? '',
        participantes: montarParticipantes(socket.user, metadados.participants, diretorio),
      };
    },
  };
}

export function criarMensageiro(socket: SocketDeGrupo, grupoJid: string): Mensageiro {
  return {
    async enviarPrivado(jid, texto) {
      await socket.sendMessage(jid, { text: texto });
    },
    async avisarGrupo(texto) {
      await socket.sendMessage(grupoJid, { text: texto });
    },
  };
}

/** Participantes do grupo, sem o próprio bot, com os nomes que o bot conhece de cada um. */
export function montarParticipantes(
  usuarioDoBot: ContatoConhecido | undefined,
  lista: ParticipanteDoGrupo[],
  diretorio: DiretorioDeNomes,
): Participante[] {
  const idsDoBot = idsNormalizadosDoBot(usuarioDoBot);

  return lista
    .filter((participante) => !ehOBot(participante, idsDoBot))
    .map((participante) => ({
      jid: participante.phoneNumber ?? participante.id,
      nomes: diretorio.nomesDe(idsDe(participante)),
    }));
}

function explicarGrupoNaoLocalizado(nomeGrupo: string, quantidade: number, assuntos: string[]): string {
  const problema =
    quantidade === 0
      ? `Não encontrei nenhum grupo chamado "${nomeGrupo}".`
      : `Há mais de um grupo chamado "${nomeGrupo}".`;

  return [
    problema,
    'Grupos em que este número participa:',
    ...assuntos.map((assunto) => `  - ${assunto}`),
    'Ajuste GROUP_NAME no arquivo .env e rode de novo.',
  ].join('\n');
}

function idsDe(participante: ParticipanteDoGrupo): Array<string | undefined> {
  return [participante.id, participante.lid, participante.phoneNumber];
}

/** Tira o número do aparelho: "5581999999999:12@s.whatsapp.net" vira "5581999999999@s.whatsapp.net". */
function semDispositivo(jid: string): string {
  return jid.replace(/:\d+(?=@)/, '');
}

function idsNormalizadosDoBot(usuario: ContatoConhecido | undefined): Set<string> {
  const ids = [usuario?.id, usuario?.lid].filter((id): id is string => Boolean(id));
  return new Set(ids.map(semDispositivo));
}

function ehOBot(participante: ParticipanteDoGrupo, idsDoBot: Set<string>): boolean {
  return idsDe(participante).some((id) => id !== undefined && idsDoBot.has(semDispositivo(id)));
}
