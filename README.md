# escala-ministerio

Bot de WhatsApp que, quando a descrição do grupo do ministério muda, lê a escala do mês e envia no privado de cada pessoa só as datas dela.

## Antes de ligar

1. **Chip ou eSIM novo**, que não seja o seu WhatsApp pessoal. Usar o número pessoal desconecta o seu celular e aumenta o risco de restrição.
2. Instale o WhatsApp nesse número e **entre no grupo** do ministério.
3. **Salve os membros nos contatos desse chip**, com o mesmo nome usado na escala. É assim que o bot sabe quem é quem (veja "Como os nomes são reconhecidos").
4. Um computador ligado com o programa rodando (Node 22 ou mais novo).

> O bot usa o [Baileys](https://github.com/WhiskeySockets/Baileys), um cliente não oficial do WhatsApp Web. A API oficial da Meta não lê a descrição de grupos comuns nem envia mensagem livre a cada membro. Clientes não oficiais podem levar à restrição do número, por isso o número é exclusivo e cada mudança de descrição gera um único envio.

## Rodando

```bash
npm install
cp .env.example .env     # no Windows: copy .env.example .env
```

Edite o `.env` e coloque o nome exato do grupo em `GROUP_NAME`. Depois:

```bash
npm start
```

Na primeira vez aparece um **QR code** no terminal. No celular do chip: WhatsApp → Aparelhos conectados → Conectar um aparelho → escaneie. A sessão fica salva na pasta `auth/` (ignorada pelo git; quem tem essa pasta controla o número, então não compartilhe).

Se o nome em `GROUP_NAME` não bater com nenhum grupo, o programa lista os grupos em que o número participa para você corrigir.

## Formato da descrição

```text
ESCALA DEZEMBRO 2026

02/12 (QUARTA-FEIRA).
- Transmissão YouTube e som: Flávio.
- Projeção Slide: Natali.

06/12 (DOMINGO) - Manhã.
- Transmissão YouTube: Gabriel F.
- Projeção Slide: Lorena.
- Som: Guilheme.

12/12 (SÁBADO) - ENCONTRO DE JOVENS
- Transmissão YouTube: Davi/Thiago.
- Projeção Slide: Maria Cybelle.
```

- Primeira linha: `ESCALA` + nome do mês + ano (ex.: `ESCALA DEZEMBRO 2026`).
- Cada bloco começa com `dd/mm` (pode ter dia da semana entre parênteses e complemento após `-`, como `- Manhã`, `- Noite` ou nome de evento).
- Abaixo da data, uma designação por linha: `- Função: Nome.` (se houver mais de uma pessoa na mesma função, separe com `/`, como `Davi/Thiago`).
- Sem acento também vale: "Flavio" encontra "Flávio".

Se o texto não seguir o modelo, o bot **não** manda privado e avisa uma vez no grupo o que ajustar.

## O que cada pessoa recebe

```text
Olá, Lorena. Sua escala de 12/2026:
• 06/12 — Manhã — Projeção Slide
• 06/12 — Noite — Projeção Slide
```

Quem não está na escala não recebe nada. Nomes que não batem com ninguém do grupo (ou que batem com mais de uma pessoa) entram num único aviso no grupo.

## Como os nomes são reconhecidos

O WhatsApp não entrega a lista de nomes do grupo ao bot. Ele conhece cada pessoa pelo **nome do contato salvo no chip** e pelo **nome de perfil** que ela usa no WhatsApp. Por isso, salvar os membros nos contatos do chip é o jeito mais confiável. Logo depois de conectar, o bot espera alguns segundos para a lista de contatos chegar antes de ler a descrição.

## Comportamento

- O último texto processado fica em `data/ultima-descricao.json`. A descrição só é reenviada se for diferente dele.
- Se o computador estiver desligado quando a descrição mudar, o bot confere a descrição ao conectar na próxima vez.
- Entre um privado e outro há uma pausa de alguns segundos.

## Comandos

```bash
npm start          # liga o bot
npm test           # testes do leitor de descrição e do casamento de nomes
npm run typecheck  # checagem de tipos
```

## Como o código está organizado

O projeto segue a **Arquitetura Hexagonal (Ports & Adapters)**: o domínio e os casos de uso não conhecem o WhatsApp, o disco nem o console — eles conversam apenas com contratos (`src/application/ports.ts`), e quem usa essas tecnologias fica nos adaptadores. Por isso quase tudo é testado sem WhatsApp.

**Domínio** (`src/domain/`, regras puras)
- `parseSchedule.ts`: lê a descrição e agrupa por pessoa.
- `matchParticipants.ts`: associa nomes da escala a participantes.
- `messages.ts`: monta os textos dos privados e dos avisos.
- `contactNames.ts`: guarda e persiste os nomes que o bot conhece de cada pessoa.

**Aplicação** (`src/application/`, casos de uso e portas)
- `ports.ts`: define os contratos (`FonteDoGrupo`, `Mensageiro`, `ArmazenamentoDeDescricao`, `Logger`).
- `scheduleProcessor.ts`: o caso de uso principal. Se a descrição mudou, lê, casa os nomes, envia e avisa.
- `groupMonitor.ts`: decide quando verificar a descrição e evita duas verificações ao mesmo tempo.
- `notify.ts`: envia os privados (um de cada vez, com pausa) e os avisos.

**Adaptadores** (`src/adapters/`, falam com o mundo exterior)
- `whatsapp/whatsappConnection.ts`: único arquivo que usa o Baileys direto. Conecta, mostra o QR, reconecta e repassa os eventos.
- `whatsapp/whatsappGroup.ts`: localiza o grupo e adapta o socket aos contratos da aplicação.
- `persistence/store.ts`: guarda o último texto processado em arquivo.
- `system/config.ts`, `system/logger.ts`, `system/timing.ts`: configuração, log e espera.

**Montagem**
- `src/index.ts`: cria as peças, liga os adaptadores às portas e inicia. Não tem regra de negócio.
