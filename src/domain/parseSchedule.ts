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
  /** Primeira linha da descrição, ex.: "ESCALA DEZEMBRO 2026". */
  titulo: string;
  /** Mês e ano da escala, ex.: "12/2026". */
  mes: string;
  pessoas: PessoaEscala[];
}

export type ResultadoParse =
  | { ok: true; escala: Escala }
  | { ok: false; erros: string[] };

type Leitura<T> = { ok: true; valor: T } | { ok: false; erros: string[] };

interface Titulo {
  texto: string;
  mes: number;
  ano: number;
}

interface Designacao {
  nome: string;
  funcao: string;
}

interface BlocoDeData {
  rotulo: string;
  designacoes: Designacao[];
}

const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const REGEX_TITULO = /^escala\s+([a-záéíóúâêôãõç]+)\s+(\d{4})\.?$/i;

/** Captura "dd/mm" e um sufixo opcional como "(DOMINGO) - Manhã." */
const REGEX_DATA = /^(\d{1,2})\/(\d{1,2})\s*(.*)$/;

/** Captura "- Função: Nome." ou marcador de lista do WhatsApp ("•⁠  ⁠Função: Nome.") */
const REGEX_DESIGNACAO = /^[-–—•*]\s+(.+)$/;

/** Minúsculo, sem acento e com espaços simples: "  João  " vira "joao". */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lê a descrição do grupo no formato:
 *
 *   ESCALA DEZEMBRO 2026
 *
 *   02/12 (QUARTA-FEIRA).
 *   - Transmissão YouTube e som: Flávio.
 *   - Projeção Slide: Natali.
 *
 *   06/12 (DOMINGO) - Manhã.
 *   - Transmissão YouTube: Gabriel F.
 *   - Projeção Slide: Lorena.
 *   - Som: Guilheme.
 *
 * Devolve a escala agrupada por pessoa ou a lista de problemas encontrados.
 */
export function parseSchedule(descricao: string): ResultadoParse {
  const linhas = numerarLinhasNaoVazias(descricao);
  if (linhas.length === 0) return falha(['A descrição está vazia.']);

  const titulo = lerTitulo(linhas[0].texto);
  if (!titulo.ok) return falha(titulo.erros);

  const blocos = agruparBlocos(linhas.slice(1), titulo.valor.ano);
  if (!blocos.ok) return falha(blocos.erros);
  if (blocos.valor.length === 0) return falha(['Não encontrei nenhuma data depois do título.']);

  return {
    ok: true,
    escala: {
      titulo: titulo.valor.texto,
      mes: formatarMes(titulo.valor.mes, titulo.valor.ano),
      pessoas: agruparPorPessoa(blocos.valor),
    },
  };
}

function numerarLinhasNaoVazias(descricao: string): Array<{ numero: number; texto: string }> {
  return descricao
    .split(/\r?\n/)
    .map((texto, indice) => ({
      numero: indice + 1,
      texto: texto.replace(/[\u200B\u2060\uFEFF]/g, '').trim(),
    }))
    .filter((linha) => linha.texto !== '');
}

function lerTitulo(linha: string): Leitura<Titulo> {
  const texto = linha.replace(/\s+/g, ' ');
  const correspondencia = REGEX_TITULO.exec(texto);
  if (!correspondencia) {
    return erro(`A primeira linha deve ser o título, como "ESCALA DEZEMBRO 2026" (encontrei "${texto}").`);
  }

  const nomeMes = correspondencia[1].toLowerCase();
  const mes = MESES[nomeMes];
  const ano = Number(correspondencia[2]);

  if (!mes) {
    return erro(`Mês desconhecido no título: "${correspondencia[1]}".`);
  }

  return sucesso({ texto, mes, ano });
}

/**
 * Agrupa as linhas em blocos: cada bloco começa com uma linha de data
 * e é seguido por linhas de designação ("- Função: Nome.").
 */
function agruparBlocos(
  linhas: Array<{ numero: number; texto: string }>,
  ano: number,
): Leitura<BlocoDeData[]> {
  const blocos: BlocoDeData[] = [];
  const erros: string[] = [];
  let blocoAtual: { rotulo: string; designacoes: Designacao[]; numeroLinha: number } | undefined;

  for (const linha of linhas) {
    const dataMatch = REGEX_DATA.exec(linha.texto);
    if (dataMatch) {
      // Fecha o bloco anterior se houver
      if (blocoAtual) {
        if (blocoAtual.designacoes.length === 0) {
          erros.push(`Linha ${blocoAtual.numeroLinha}: nenhuma pessoa informada para ${blocoAtual.rotulo}.`);
        } else {
          blocos.push({ rotulo: blocoAtual.rotulo, designacoes: blocoAtual.designacoes });
        }
      }

      const [, diaTexto, mesTexto, sufixo] = dataMatch;
      const data = formatarData(Number(diaTexto), Number(mesTexto), ano);
      if (!data) {
        erros.push(`Linha ${linha.numero}: a data ${diaTexto}/${mesTexto} não existe.`);
        blocoAtual = undefined;
        continue;
      }

      const rotulo = montarRotulo(data, sufixo);
      blocoAtual = { rotulo, designacoes: [], numeroLinha: linha.numero };
      continue;
    }

    const desigMatch = REGEX_DESIGNACAO.exec(linha.texto);
    if (desigMatch && blocoAtual) {
      const resultado = lerDesignacao(desigMatch[1], linha.numero);
      if (!resultado.ok) {
        erros.push(...resultado.erros);
      } else {
        blocoAtual.designacoes.push(...resultado.valor);
      }
      continue;
    }

    // Linha que não é data nem designação
    erros.push(`Linha ${linha.numero}: "${linha.texto}" não segue o formato esperado.`);
  }

  // Fecha o último bloco
  if (blocoAtual) {
    if (blocoAtual.designacoes.length === 0) {
      erros.push(`Linha ${blocoAtual.numeroLinha}: nenhuma pessoa informada para ${blocoAtual.rotulo}.`);
    } else {
      blocos.push({ rotulo: blocoAtual.rotulo, designacoes: blocoAtual.designacoes });
    }
  }

  if (erros.length > 0) return { ok: false, erros };
  return sucesso(blocos);
}

/** Monta o rótulo da data, ex.: "02/12" ou "06/12 — Manhã" */
function montarRotulo(data: string, sufixo: string): string {
  const semDiaSemana = sufixo.replace(/\([^)]*\)/g, '').trim();
  const complemento = semDiaSemana
    .replace(/^[-–—.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .trim();

  if (complemento === '') return data;
  return `${data} — ${complemento}`;
}

/**
 * Lê "Função: Nome." ou "Função: Nome1/Nome2.".
 * Devolve uma ou mais designações (quando há "/" no nome, cria uma para cada).
 */
function lerDesignacao(corpo: string, numeroLinha: number): Leitura<Designacao[]> {
  const separador = corpo.indexOf(':');
  if (separador === -1) {
    return erro(`Linha ${numeroLinha}: "${corpo}" não segue o modelo "Função: Nome".`);
  }

  const funcao = corpo.slice(0, separador).trim();
  const nomeBruto = corpo
    .slice(separador + 1)
    .replace(/\.+$/, '')
    .trim();

  if (funcao === '' || nomeBruto === '') {
    return erro(`Linha ${numeroLinha}: "${corpo}" não segue o modelo "Função: Nome".`);
  }

  // "Davi/Thiago" → duas designações
  const nomes = nomeBruto.split('/').map((n) => n.trim()).filter((n) => n !== '');
  if (nomes.length === 0) {
    return erro(`Linha ${numeroLinha}: nenhum nome encontrado em "${corpo}".`);
  }

  return sucesso(nomes.map((nome) => ({ nome, funcao })));
}

function agruparPorPessoa(blocos: BlocoDeData[]): PessoaEscala[] {
  const pessoas = new Map<string, PessoaEscala>();

  for (const { rotulo, designacoes } of blocos) {
    for (const { nome, funcao } of designacoes) {
      const chave = normalizarNome(nome);
      const pessoa = pessoas.get(chave) ?? { nome, chave, itens: [] };
      pessoa.itens.push({ data: rotulo, funcao });
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
