import type { Logger } from '../../application/ports';

export const loggerDeConsole: Logger = {
  info: (mensagem) => console.log(mensagem),
  erro: (mensagem, detalhe) =>
    detalhe === undefined ? console.error(mensagem) : console.error(mensagem, detalhe),
};

export const loggerSilencioso: Logger = {
  info: () => {},
  erro: () => {},
};
