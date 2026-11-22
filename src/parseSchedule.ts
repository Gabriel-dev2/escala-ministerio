export interface ItemEscala {
  data: string;
  funcao: string;
}

export interface PessoaEscala {
  /** Nome como foi escrito pela primeira vez na descrição. */
  nome: string;
  /** Nome normalizado (minúsculo, sem acento), usado para agrupar e comparar. */
  chave: string;
  itens: ItemEscala[];
}

export interface Escala {
  /** Primeira linha da descrição, ex.: "ESCALA 11/2026". */
  titulo: string;
  /** Mês e ano da escala, ex.: "11/2026". */
  mes: string;
  pessoas: PessoaEscala[];
}

export type ResultadoParse =
  | { ok: true; escala: Escala }
  | { ok: false; erros: string[] };

type Leitura<T> = { ok: true; valor: T } | { ok: false; erros: string[] };

interface LinhaNumerada {
  numero: number;
  texto: string;
}

interface Titulo {
  texto: string;
  mes: number;
  ano: number;
}

interface Designacao {
  nome: string;
  funcao: string;
}

interface LinhaDeEscala {
  data: string;
  designacoes: Designacao[];
}

const REGEX_TITULO = /^escala\s+(\d{1,2})\/(\d{4})$/i;
const REGEX_LINHA = /^(\d{1,2})\/(\d{1,2})\s*\|\s*(.*)$/;

/** Minúsculo, sem acento e com espaços simples: "  João  " vira "joao". */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lê a descrição do grupo no formato:
 *
 *   ESCALA 11/2026
 *   05/11 | Ana: voz; João: teclado
 *   12/11 | Ana: back; Maria: voz
 *
 * Devolve a escala agrupada por pessoa ou a lista de problemas encontrados.
 */
export function parseSchedule(descricao: string): ResultadoParse {
  const [linhaDoTitulo, ...linhasDeData] = numerarLinhasNaoVazias(descricao);
  if (!linhaDoTitulo) return falha(['A descrição está vazia.']);

  const titulo = lerTitulo(linhaDoTitulo.texto);
  if (!titulo.ok) return falha(titulo.erros);

  const linhas = reunir(linhasDeData.map((linha) => lerLinhaDeData(linha, titulo.valor.ano)));
  if (!linhas.ok) return falha(linhas.erros);
  if (linhas.valor.length === 0) return falha(['Não encontrei nenhuma data depois do título.']);

  return {
    ok: true,
    escala: {
      titulo: titulo.valor.texto,
      mes: formatarMes(titulo.valor.mes, titulo.valor.ano),
      pessoas: agruparPorPessoa(linhas.valor),
    },
  };
}

function numerarLinhasNaoVazias(descricao: string): LinhaNumerada[] {
  return descricao
    .split(/\r?\n/)
    .map((texto, indice) => ({ numero: indice + 1, texto: texto.trim() }))
    .filter((linha) => linha.texto !== '');
}

function lerTitulo(linha: string): Leitura<Titulo> {
  const texto = linha.replace(/\s+/g, ' ');
  const correspondencia = REGEX_TITULO.exec(texto);
  if (!correspondencia) {
    return erro(`A primeira linha deve ser o título, como "ESCALA 11/2026" (encontrei "${texto}").`);
  }

  const mes = Number(correspondencia[1]);
  const ano = Number(correspondencia[2]);
  if (!mesExiste(mes)) return erro(`Mês inválido no título: "${texto}".`);

  return sucesso({ texto, mes, ano });
}

function lerLinhaDeData(linha: LinhaNumerada, ano: number): Leitura<LinhaDeEscala> {
  const correspondencia = REGEX_LINHA.exec(linha.texto);
  if (!correspondencia) {
    return erro(`Linha ${linha.numero}: "${linha.texto}" não segue o modelo "dd/mm | Nome: função".`);
  }

  const [, diaTexto, mesTexto, corpo] = correspondencia;
  const data = formatarData(Number(diaTexto), Number(mesTexto), ano);
  if (!data) return erro(`Linha ${linha.numero}: a data ${diaTexto}/${mesTexto} não existe.`);

  const trechos = separarTrechos(corpo);
  if (trechos.length === 0) return erro(`Linha ${linha.numero}: nenhuma pessoa informada para ${data}.`);

  const designacoes = reunir(trechos.map((trecho) => lerDesignacao(trecho, linha.numero)));
  if (!designacoes.ok) return designacoes;

  return sucesso({ data, designacoes: designacoes.valor });
}

function separarTrechos(corpo: string): string[] {
  return corpo
    .split(';')
    .map((trecho) => trecho.trim())
    .filter((trecho) => trecho !== '');
}

function lerDesignacao(trecho: string, numeroLinha: number): Leitura<Designacao> {
  const [nomeBruto, ...restoDoTrecho] = trecho.split(':');
  const nome = nomeBruto.trim();
  const funcao = restoDoTrecho.join(':').trim();

  if (nome === '' || funcao === '') {
    return erro(`Linha ${numeroLinha}: "${trecho}" não segue o modelo "Nome: função".`);
  }
  return sucesso({ nome, funcao });
}

function agruparPorPessoa(linhas: LinhaDeEscala[]): PessoaEscala[] {
  const pessoas = new Map<string, PessoaEscala>();

  for (const { data, designacoes } of linhas) {
    for (const { nome, funcao } of designacoes) {
      const chave = normalizarNome(nome);
      const pessoa = pessoas.get(chave) ?? { nome, chave, itens: [] };
      pessoa.itens.push({ data, funcao });
      pessoas.set(chave, pessoa);
    }
  }

  return [...pessoas.values()];
}

function mesExiste(mes: number): boolean {
  return mes >= 1 && mes <= 12;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

function formatarMes(mes: number, ano: number): string {
  return `${doisDigitos(mes)}/${ano}`;
}

/** Devolve "dd/mm" ou undefined quando a data não existe naquele ano. */
function formatarData(dia: number, mes: number, ano: number): string | undefined {
  if (!mesExiste(mes) || dia < 1 || dia > diasNoMes(ano, mes)) return undefined;
  return `${doisDigitos(dia)}/${doisDigitos(mes)}`;
}

function sucesso<T>(valor: T): Leitura<T> {
  return { ok: true, valor };
}

function erro(...erros: string[]): Leitura<never> {
  return { ok: false, erros };
}

function falha(erros: string[]): ResultadoParse {
  return { ok: false, erros };
}

/** Junta várias leituras: se alguma falhou, devolve todos os erros; senão, todos os valores. */
function reunir<T>(leituras: Leitura<T>[]): Leitura<T[]> {
  const erros = leituras.flatMap((leitura) => (leitura.ok ? [] : leitura.erros));
  if (erros.length > 0) return { ok: false, erros };

  return sucesso(leituras.flatMap((leitura) => (leitura.ok ? [leitura.valor] : [])));
}
