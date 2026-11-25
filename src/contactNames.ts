import fs from 'node:fs';
import path from 'node:path';

export interface ContatoConhecido {
  id?: string;
  lid?: string;
  phoneNumber?: string;
  /** Nome salvo nos contatos do chip do bot. */
  name?: string | null;
  /** Nome de perfil que a própria pessoa usa no WhatsApp. */
  notify?: string | null;
}

/** Guarda os nomes que o bot conhece para cada id do WhatsApp. */
export interface DiretorioDeNomes {
  registrarContato(contato: ContatoConhecido): void;
  registrarContatos(contatos: ContatoConhecido[]): void;
  registrarRemetente(id: string | null | undefined, nomeDePerfil: string | null | undefined): void;
  nomesDe(ids: Array<string | undefined>): string[];
}

export function criarDiretorioDeNomes(arquivo?: string): DiretorioDeNomes {
  const nomesPorId = arquivo ? carregarNomes(arquivo) : new Map<string, Set<string>>();

  function guardar(ids: Array<string | undefined>, nome: string | null | undefined): boolean {
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) return false;

    let alterou = false;
    for (const id of ids) {
      if (!id) continue;
      const nomes = nomesPorId.get(id) ?? new Set<string>();
      if (!nomes.has(nomeLimpo)) {
        nomes.add(nomeLimpo);
        nomesPorId.set(id, nomes);
        alterou = true;
      }
    }
    return alterou;
  }

  function registrarUmContato(contato: ContatoConhecido): boolean {
    const ids = [contato.id, contato.lid, contato.phoneNumber];
    const salvouNome = guardar(ids, contato.name);
    const salvouPerfil = guardar(ids, contato.notify);
    return salvouNome || salvouPerfil;
  }

  function persistirSeAlterou(alterou: boolean): void {
    if (alterou && arquivo) gravarNomes(arquivo, nomesPorId);
  }

  return {
    registrarContato(contato) {
      persistirSeAlterou(registrarUmContato(contato));
    },

    registrarContatos(contatos) {
      let alterou = false;
      for (const contato of contatos) {
        if (registrarUmContato(contato)) alterou = true;
      }
      persistirSeAlterou(alterou);
    },

    registrarRemetente(id, nomeDePerfil) {
      persistirSeAlterou(guardar([id ?? undefined], nomeDePerfil));
    },

    nomesDe(ids) {
      const nomes = new Set<string>();
      for (const id of ids) {
        for (const nome of nomesPorId.get(id ?? '') ?? []) nomes.add(nome);
      }
      return [...nomes];
    },
  };
}

function carregarNomes(arquivo: string): Map<string, Set<string>> {
  try {
    const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Record<string, string[]>;
    const mapa = new Map<string, Set<string>>();
    for (const [id, nomes] of Object.entries(dados)) {
      if (Array.isArray(nomes)) mapa.set(id, new Set(nomes));
    }
    return mapa;
  } catch {
    return new Map<string, Set<string>>();
  }
}

function gravarNomes(arquivo: string, nomesPorId: Map<string, Set<string>>): void {
  const objeto: Record<string, string[]> = {};
  for (const [id, nomes] of nomesPorId) {
    objeto[id] = [...nomes];
  }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(objeto, null, 2), 'utf8');
}
