export interface Configuracao {
  nomeGrupo: string;
}

export function carregarArquivoEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // Sem arquivo .env: usa as variáveis do ambiente.
  }
}

export function carregarConfiguracao(ambiente: NodeJS.ProcessEnv = process.env): Configuracao {
  const nomeGrupo = ambiente.GROUP_NAME?.trim();
  if (!nomeGrupo) {
    throw new Error('Defina GROUP_NAME no arquivo .env (veja .env.example).');
  }

  return { nomeGrupo };
}
