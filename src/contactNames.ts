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
  registrarRemetente(id: string | null | undefined, nomeDePerfil: string | null | undefined): void;
  nomesDe(ids: Array<string | undefined>): string[];
}

export function criarDiretorioDeNomes(): DiretorioDeNomes {
  const nomesPorId = new Map<string, Set<string>>();

  function guardar(ids: Array<string | undefined>, nome: string | null | undefined): void {
    const nomeLimpo = nome?.trim();
    if (!nomeLimpo) return;

    for (const id of ids) {
      if (!id) continue;
      const nomes = nomesPorId.get(id) ?? new Set<string>();
      nomes.add(nomeLimpo);
      nomesPorId.set(id, nomes);
    }
  }

  return {
    registrarContato(contato) {
      const ids = [contato.id, contato.lid, contato.phoneNumber];
      guardar(ids, contato.name);
      guardar(ids, contato.notify);
    },

    registrarRemetente(id, nomeDePerfil) {
      guardar([id ?? undefined], nomeDePerfil);
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
