import type { Participante } from '../domain/matchParticipants';

/**
 * Contratos que o caso de uso precisa do mundo exterior.
 * Quem usa o Baileys, o disco ou o console implementa; a regra de negócio só conhece estes tipos.
 */

export interface Logger {
  info(mensagem: string): void;
  erro(mensagem: string, detalhe?: unknown): void;
}

export interface DadosDoGrupo {
  descricao: string;
  participantes: Participante[];
}

export interface FonteDoGrupo {
  carregarDados(): Promise<DadosDoGrupo>;
}

export interface Mensageiro {
  enviarPrivado(jid: string, texto: string): Promise<void>;
  avisarGrupo(texto: string): Promise<void>;
}

export interface ArmazenamentoDeDescricao {
  /** Último texto processado, ou undefined se nunca houve um. */
  ler(): string | undefined;
  salvar(descricao: string): void;
}
