import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import type { DiretorioDeNomes } from './contactNames';
import type { Logger } from './ports';

const PASTA_DA_SESSAO = 'auth';
const ATRASO_RECONEXAO_MS = 3000;

export interface OpcoesDeConexao {
  diretorio: DiretorioDeNomes;
  logger: Logger;
  aoConectar: (socket: WASocket) => void;
  aoMudarDescricaoDeGrupo: (grupoJid: string) => void;
  aoSessaoEncerrada: () => void;
}

/** Abre a conexão com o WhatsApp, mostra o QR quando preciso e reconecta se cair. */
export async function conectarAoWhatsApp(opcoes: OpcoesDeConexao): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_DA_SESSAO);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const socket = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
  });

  socket.ev.on('creds.update', saveCreds);
  registrarNomes(socket, opcoes.diretorio);
  registrarMudancasDeDescricao(socket, opcoes.aoMudarDescricaoDeGrupo);
  registrarCicloDeVida(socket, opcoes);
}

function registrarNomes(socket: WASocket, diretorio: DiretorioDeNomes): void {
  socket.ev.on('contacts.upsert', (contatos) => {
    contatos.forEach((contato) => diretorio.registrarContato(contato));
  });

  socket.ev.on('contacts.update', (contatos) => {
    contatos.forEach((contato) => diretorio.registrarContato(contato));
  });

  socket.ev.on('messaging-history.set', ({ contacts }) => {
    contacts.forEach((contato) => diretorio.registrarContato(contato));
  });

  socket.ev.on('messages.upsert', ({ messages }) => {
    for (const mensagem of messages) {
      if (mensagem.key.fromMe) continue;

      // Em grupo o remetente vem em "participant"; no privado, em "remoteJid".
      diretorio.registrarRemetente(mensagem.key.participant ?? mensagem.key.remoteJid, mensagem.pushName);
    }
  });
}

function registrarMudancasDeDescricao(socket: WASocket, aoMudar: (grupoJid: string) => void): void {
  socket.ev.on('groups.update', (atualizacoes) => {
    for (const { id, desc } of atualizacoes) {
      if (id && desc !== undefined) aoMudar(id);
    }
  });
}

function registrarCicloDeVida(socket: WASocket, opcoes: OpcoesDeConexao): void {
  socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) mostrarQrCode(qr, opcoes.logger);

    if (connection === 'open') {
      opcoes.logger.info('Conectado ao WhatsApp.');
      opcoes.aoConectar(socket);
    }

    if (connection === 'close') tratarFechamento(lastDisconnect?.error, opcoes);
  });
}

function mostrarQrCode(qr: string, logger: Logger): void {
  logger.info('Escaneie o QR code com o WhatsApp do número do bot (Aparelhos conectados):');
  qrcode.generate(qr, { small: true });
}

function tratarFechamento(erro: unknown, opcoes: OpcoesDeConexao): void {
  if (lerCodigoDeStatus(erro) === DisconnectReason.loggedOut) {
    opcoes.aoSessaoEncerrada();
    return;
  }

  opcoes.logger.info('Conexão fechada. Reconectando...');
  setTimeout(() => reconectar(opcoes), ATRASO_RECONEXAO_MS);
}

function reconectar(opcoes: OpcoesDeConexao): void {
  conectarAoWhatsApp(opcoes).catch((erro) => opcoes.logger.erro('Erro ao reconectar:', erro));
}

/** O Baileys entrega o código HTTP do motivo da queda em erro.output.statusCode. */
function lerCodigoDeStatus(erro: unknown): number | undefined {
  if (typeof erro !== 'object' || erro === null || !('output' in erro)) return undefined;

  const { output } = erro;
  if (typeof output !== 'object' || output === null || !('statusCode' in output)) return undefined;

  return typeof output.statusCode === 'number' ? output.statusCode : undefined;
}
