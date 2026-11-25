import fs from 'node:fs';
import path from 'node:path';

export interface Configuracao {
  nomeGrupo: string;
}

const ARQUIVO_ENV_PADRAO = path.resolve('.env');

/**
 * Carrega o arquivo .env para process.env, sem sobrescrever variáveis já definidas.
 * Se o arquivo não existir, segue com o ambiente atual; se existir e estiver ilegível, avisa o motivo.
 */
export function carregarArquivoEnv(
  caminho: string = ARQUIVO_ENV_PADRAO,
  ambiente: NodeJS.ProcessEnv = process.env,
): void {
  const conteudo = lerTextoSeExistir(caminho);
  if (conteudo === undefined) return;

  for (const [chave, valor] of Object.entries(interpretarEnv(conteudo))) {
    if (ambiente[chave] === undefined) ambiente[chave] = valor;
  }
}

export function carregarConfiguracao(
  ambiente: NodeJS.ProcessEnv = process.env,
  caminhoDoEnv: string = ARQUIVO_ENV_PADRAO,
): Configuracao {
  const nomeGrupo = ambiente.GROUP_NAME?.trim();
  if (!nomeGrupo) throw new Error(explicarGroupNameAusente(caminhoDoEnv));

  return { nomeGrupo };
}

/** Lê linhas CHAVE=valor, ignorando comentários, linhas em branco e aspas em volta do valor. */
export function interpretarEnv(conteudo: string): Record<string, string> {
  const variaveis: Record<string, string> = {};

  for (const linhaBruta of conteudo.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (linha === '' || linha.startsWith('#')) continue;

    const separador = linha.indexOf('=');
    if (separador === -1) continue;

    const chave = linha.slice(0, separador).replace(/^export\s+/, '').trim();
    if (chave === '') continue;

    variaveis[chave] = removerAspas(linha.slice(separador + 1).trim());
  }

  return variaveis;
}

/** Converte os bytes do arquivo em texto, aceitando UTF-8, UTF-8 com BOM e UTF-16. */
export function decodificarTexto(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return trocarOrdemDosBytes(bytes.subarray(2)).toString('utf16le');
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return bytes.subarray(3).toString('utf8');

  return bytes.toString('utf8');
}

function lerTextoSeExistir(caminho: string): string | undefined {
  try {
    return decodificarTexto(fs.readFileSync(caminho));
  } catch (erro) {
    if (codigoDoErro(erro) === 'ENOENT') return undefined;
    throw new Error(`Não consegui ler o arquivo ${caminho}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

function explicarGroupNameAusente(caminhoDoEnv: string): string {
  const pasta = path.dirname(caminhoDoEnv);
  const problema = fs.existsSync(caminhoDoEnv)
    ? `O arquivo ${caminhoDoEnv} existe, mas não tem a linha GROUP_NAME=nome do grupo.`
    : `Não encontrei o arquivo ${caminhoDoEnv}.${dicaDeNomeErrado(pasta)}`;

  return `Defina GROUP_NAME no arquivo .env (veja .env.example). ${problema}`;
}

/** No Windows é comum o arquivo ficar como ".env.txt" porque a extensão está escondida. */
function dicaDeNomeErrado(pasta: string): string {
  const parecidos = listarArquivos(pasta).filter((nome) => /^\.?env(\..+)?$/i.test(nome) && nome !== '.env.example');
  if (parecidos.length === 0) return '';

  return ` Achei ${parecidos.map((nome) => `"${nome}"`).join(', ')}: renomeie para exatamente ".env".`;
}

function listarArquivos(pasta: string): string[] {
  try {
    return fs.readdirSync(pasta);
  } catch {
    return [];
  }
}

function removerAspas(valor: string): string {
  const aspas = valor[0];
  const fechada = (aspas === '"' || aspas === "'") && valor.length >= 2 && valor.endsWith(aspas);
  return fechada ? valor.slice(1, -1) : valor;
}

function trocarOrdemDosBytes(bytes: Buffer): Buffer {
  const copia = Buffer.from(bytes);
  copia.swap16();
  return copia;
}

function codigoDoErro(erro: unknown): string | undefined {
  return typeof erro === 'object' && erro !== null && 'code' in erro ? String(erro.code) : undefined;
}
