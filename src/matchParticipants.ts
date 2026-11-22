import { normalizarNome, type PessoaEscala } from './parseSchedule';

export interface Participante {
  /** Endereço para onde o privado será enviado. */
  jid: string;
  /** Nomes com que o bot conhece a pessoa (contato salvo, nome de perfil). */
  nomes: string[];
}

export interface Encontrado {
  pessoa: PessoaEscala;
  jid: string;
}

export interface ResultadoCasamento {
  encontrados: Encontrado[];
  /** Nomes da escala que não batem com ninguém do grupo. */
  naoEncontrados: string[];
  /** Nomes da escala que batem com mais de uma pessoa (não enviamos para evitar erro). */
  ambiguos: string[];
}

/**
 * Associa cada nome da escala a um participante do grupo comparando os nomes
 * normalizados (minúsculo, sem acento). Só envia quando há exatamente uma pessoa.
 */
export function casarParticipantes(
  pessoas: PessoaEscala[],
  participantes: Participante[],
): ResultadoCasamento {
  const jidsPorNome = indexarJidsPorNome(participantes);
  const resultado: ResultadoCasamento = { encontrados: [], naoEncontrados: [], ambiguos: [] };

  for (const pessoa of pessoas) {
    const jids = [...(jidsPorNome.get(pessoa.chave) ?? [])];

    if (jids.length === 1) {
      resultado.encontrados.push({ pessoa, jid: jids[0] });
    } else if (jids.length === 0) {
      resultado.naoEncontrados.push(pessoa.nome);
    } else {
      resultado.ambiguos.push(pessoa.nome);
    }
  }

  return resultado;
}

function indexarJidsPorNome(participantes: Participante[]): Map<string, Set<string>> {
  const jidsPorNome = new Map<string, Set<string>>();

  for (const { jid, nomes } of participantes) {
    for (const nome of nomes) {
      const chave = normalizarNome(nome);
      if (chave === '') continue;

      const jids = jidsPorNome.get(chave) ?? new Set<string>();
      jids.add(jid);
      jidsPorNome.set(chave, jids);
    }
  }

  return jidsPorNome;
}
