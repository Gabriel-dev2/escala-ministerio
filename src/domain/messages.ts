import type { ResultadoCasamento } from './matchParticipants';
import type { PessoaEscala } from './parseSchedule';

const MAXIMO_ERROS_NO_AVISO = 5;

const MODELO_DESCRICAO = [
  'ESCALA 11/2026',
  '05/11 | Ana: voz; João: teclado',
  '12/11 | Ana: back; Maria: voz',
].join('\n');

export function montarMensagemPessoa(pessoa: PessoaEscala, mes: string): string {
  const linhas = pessoa.itens.map((item) => `• ${item.data} — ${item.funcao}`);
  return [`Olá, ${pessoa.nome}. Sua escala de ${mes}:`, ...linhas].join('\n');
}

export function montarAvisoFormato(erros: string[]): string {
  return [
    'Não consegui ler a escala da descrição do grupo, então não enviei nada no privado.',
    'Ajuste a descrição e salve de novo:',
    ...listarErros(erros),
    '',
    'Modelo:',
    MODELO_DESCRICAO,
  ].join('\n');
}

/** Devolve null quando todos os nomes foram encontrados. */
export function montarAvisoNomes(casamento: ResultadoCasamento): string | null {
  const trechos = [
    ...descreverNaoEncontrados(casamento.naoEncontrados),
    ...descreverAmbiguos(casamento.ambiguos),
  ];
  if (trechos.length === 0) return null;

  return ['Escala enviada, menos para quem não consegui identificar:', ...trechos].join('\n');
}

function listarErros(erros: string[]): string[] {
  const mostrados = erros.slice(0, MAXIMO_ERROS_NO_AVISO).map((erro) => `• ${erro}`);
  const omitidos = erros.length - mostrados.length;

  return omitidos > 0 ? [...mostrados, `• ... e mais ${omitidos} problema(s).`] : mostrados;
}

function descreverNaoEncontrados(nomes: string[]): string[] {
  if (nomes.length === 0) return [];

  return [
    `Não encontrei no grupo: ${nomes.join(', ')}. ` +
      'Confira se o nome na escala está igual ao nome da pessoa no grupo.',
  ];
}

function descreverAmbiguos(nomes: string[]): string[] {
  if (nomes.length === 0) return [];

  return [`Mais de uma pessoa com o nome: ${nomes.join(', ')}. Use um nome que só uma pessoa tenha.`];
}
