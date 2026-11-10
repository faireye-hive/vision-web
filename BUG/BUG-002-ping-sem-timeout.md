# BUG-002 — pings de RPC podem ficar pendentes e se acumular

- **Gravidade:** P2
- **Área:** indicador e seletor de nós RPC
- **Estado:** corrigido em 2026-11-10 (neste worktree)

## Evidência

Na versão auditada (`9def108`), `pingNode` em [`src/services/hiveApi.ts`](../src/services/hiveApi.ts) fazia `fetch` sem prazo máximo. O [`Navbar`](../src/components/Navbar.tsx) o chamava na montagem, a cada 25 segundos e para cada nó ao abrir o seletor. O [`modal de estatísticas`](../src/components/BlockchainStatsModal.tsx) também usava pings paralelos.

## Impacto

Se um endpoint aceitar a conexão mas nunca responder, a Promise pode ficar aberta. O intervalo continua disparando a cada 25 segundos e novas aberturas do seletor lançam pings adicionais, mantendo requisições concorrentes sem limite de tempo e atualizando o indicador com resultados atrasados.

## Como reproduzir

1. Use um nó que estabeleça conexão e não conclua a resposta JSON-RPC.
2. Aguarde mais de 25 segundos ou abra/feche o seletor de nós repetidamente.
3. Observe que o ping anterior não é cancelado nem expira antes de novas tentativas.

## Correção aplicada

Cada ping expira em **5 segundos**, incluindo a leitura do JSON, com cancelamento real via `AbortController`. Chamadas simultâneas para a mesma URL compartilham uma única requisição entre Navbar, menu e modal. Após sucesso ou falha, o mapa é limpo e uma nova tentativa é permitida.

O menu ignora resultados depois de fechado. O modal ignora resultados de uma varredura anterior ou após desmontar. Pings compartilhados já iniciados podem terminar em segundo plano, sempre limitados pelo prazo de 5 segundos; fechar e reabrir não duplica a requisição em andamento.

## Verificação

[`src/services/hiveApi.test.ts`](../src/services/hiveApi.test.ts) confirma requisição única para pings concorrentes, abort após 5 segundos, resultado `-1` em falha, nova tentativa após expirar e rejeição de respostas com erro JSON-RPC. [`src/services/http.test.ts`](../src/services/http.test.ts) cobre o caso em que os cabeçalhos chegam mas o corpo JSON nunca termina, além da limpeza dos timers.
