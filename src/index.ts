import path from 'node:path';
import { carregarArquivoEnv, carregarConfiguracao } from './adapters/system/config';
import { criarDiretorioDeNomes } from './domain/contactNames';
import { criarMonitorDeGrupo } from './application/groupMonitor';
import { loggerDeConsole as logger } from './adapters/system/logger';
import { pausaAleatoriaEntreEnvios } from './application/notify';
import { criarArmazenamentoEmArquivo } from './adapters/persistence/store';
import { esperar } from './adapters/system/timing';
import { conectarAoWhatsApp } from './adapters/whatsapp/whatsappConnection';
import { ErroDeGrupo } from './adapters/whatsapp/whatsappGroup';

const ARQUIVO_DA_ULTIMA_DESCRICAO = path.resolve('data', 'ultima-descricao.json');
const ARQUIVO_DE_CONTATOS = path.resolve('data', 'contatos.json');
const ESPERA_SINCRONIZACAO_MS = 15_000;

function encerrarPorErro(mensagem: string): never {
  logger.erro(mensagem);
  process.exit(1);
}

function tratarFalha(erro: unknown): void {
  if (erro instanceof ErroDeGrupo) encerrarPorErro(erro.message);

  logger.erro('Erro ao processar a escala:', erro);
}

async function iniciar(): Promise<void> {
  carregarArquivoEnv();
  const { nomeGrupo } = carregarConfiguracao();
  const diretorio = criarDiretorioDeNomes(ARQUIVO_DE_CONTATOS);

  const monitor = criarMonitorDeGrupo({
    nomeGrupo,
    diretorio,
    criarArmazenamento: (grupoJid) => criarArmazenamentoEmArquivo(ARQUIVO_DA_ULTIMA_DESCRICAO, grupoJid),
    logger,
    pausarEntreEnvios: pausaAleatoriaEntreEnvios,
    aguardarSincronizacao: () => esperar(ESPERA_SINCRONIZACAO_MS),
    aoFalhar: tratarFalha,
  });

  await conectarAoWhatsApp({
    diretorio,
    logger,
    aoConectar: monitor.aoConectar,
    aoMudarDescricaoDeGrupo: monitor.aoMudarDescricao,
    aoSessaoEncerrada: () =>
      encerrarPorErro('A sessão foi encerrada no celular. Apague a pasta "auth" e rode de novo para escanear o QR.'),
  });
}

iniciar().catch((erro: unknown) => {
  encerrarPorErro(erro instanceof Error ? erro.message : String(erro));
});
