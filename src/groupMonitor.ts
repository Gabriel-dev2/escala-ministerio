import type { DiretorioDeNomes } from './contactNames';
import type { ArmazenamentoDeDescricao, Logger } from './ports';
import { criarProcessadorDeEscala, type ProcessadorDeEscala } from './scheduleProcessor';
import { criarFonteDoGrupo, criarMensageiro, localizarGrupo, type SocketDeGrupo } from './whatsappGroup';

export interface DependenciasDoMonitor {
  nomeGrupo: string;
  diretorio: DiretorioDeNomes;
  criarArmazenamento: (grupoJid: string) => ArmazenamentoDeDescricao;
  logger: Logger;
  pausarEntreEnvios: () => Promise<void>;
  /** Dá tempo para o WhatsApp entregar os nomes dos contatos logo após conectar. */
  aguardarSincronizacao: () => Promise<void>;
  aoFalhar: (erro: unknown) => void;
}

export interface MonitorDeGrupo {
  aoConectar(socket: SocketDeGrupo): void;
  aoMudarDescricao(grupoJid: string): void;
  /** Resolve quando todo o trabalho já agendado terminar. */
  aguardarConclusao(): Promise<void>;
}

interface GrupoMonitorado {
  jid: string;
  processador: ProcessadorDeEscala;
}

/** Decide quando verificar a descrição do grupo e garante que uma verificação não atropele a outra. */
export function criarMonitorDeGrupo(dependencias: DependenciasDoMonitor): MonitorDeGrupo {
  const { nomeGrupo, diretorio, criarArmazenamento, logger, pausarEntreEnvios, aguardarSincronizacao, aoFalhar } =
    dependencias;

  let grupoMonitorado: GrupoMonitorado | undefined;
  let fila: Promise<void> = Promise.resolve();

  function agendar(tarefa: () => Promise<void>): void {
    fila = fila.then(tarefa).catch(aoFalhar);
  }

  function criarProcessador(socket: SocketDeGrupo, grupoJid: string): ProcessadorDeEscala {
    return criarProcessadorDeEscala({
      grupo: criarFonteDoGrupo(socket, grupoJid, diretorio),
      armazenamento: criarArmazenamento(grupoJid),
      mensageiro: criarMensageiro(socket, grupoJid),
      logger,
      pausarEntreEnvios,
    });
  }

  async function iniciarMonitoramento(socket: SocketDeGrupo): Promise<void> {
    const jid = await localizarGrupo(socket, nomeGrupo);
    const monitorado = { jid, processador: criarProcessador(socket, jid) };
    grupoMonitorado = monitorado;
    logger.info(`Monitorando o grupo "${nomeGrupo}".`);

    await aguardarSincronizacao();
    await monitorado.processador.processarSeDescricaoMudou();
  }

  return {
    aoConectar(socket) {
      agendar(() => iniciarMonitoramento(socket));
    },

    aoMudarDescricao(grupoJid) {
      const monitorado = grupoMonitorado;
      if (monitorado?.jid !== grupoJid) return;

      agendar(() => monitorado.processador.processarSeDescricaoMudou());
    },

    aguardarConclusao() {
      return fila;
    },
  };
}
