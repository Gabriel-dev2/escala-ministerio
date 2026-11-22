import fs from 'node:fs';
import path from 'node:path';
import type { ArmazenamentoDeDescricao } from './ports';

type Registro = Record<string, string>;

/** Guarda o último texto processado de um grupo num arquivo JSON. */
export function criarArmazenamentoEmArquivo(arquivo: string, grupoJid: string): ArmazenamentoDeDescricao {
  return {
    ler: () => lerRegistro(arquivo)[grupoJid],
    salvar: (descricao) => gravarRegistro(arquivo, { ...lerRegistro(arquivo), [grupoJid]: descricao }),
  };
}

function lerRegistro(arquivo: string): Registro {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Registro;
  } catch {
    // Arquivo ainda não existe: começa do zero.
    return {};
  }
}

function gravarRegistro(arquivo: string, registro: Registro): void {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(registro, null, 2), 'utf8');
}
