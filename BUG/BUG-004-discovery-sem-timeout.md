# BUG-004 — descoberta por idioma pode ficar carregando indefinidamente

- **Gravidade:** P2
- **Área:** Discover por idioma / Combflow / HiveSense
- **Estado:** corrigido em 2026-11-10 (neste worktree)

## Evidência

Na versão auditada (`9def108`), `browseCombflowPosts` e `fetchHiveSensePostsByIds` em [`src/services/combflowApi.ts`](../src/services/combflowApi.ts) faziam `fetch` sem timeout. `getLanguageDiscoveryFeed` esperava as duas chamadas em sequência. Em [`DiscoverPage.tsx`](../src/pages/DiscoverPage.tsx), `loading` só voltava a `false` no `finally`, depois que essa Promise terminasse.

## Impacto

Se Combflow ou HiveSense deixar a conexão pendente, a tela de Discover filtrada por idioma permanece nos skeletons/carregamento, sem acionar o estado de erro nem permitir uma nova tentativa baseada em timeout.

## Como reproduzir

1. No Discover, selecione um idioma diferente de Global.
2. Simule uma conexão que não resolve para `combflow.net/api/browse` ou `api.hive.blog/hivesense-api/posts/by-ids`.
3. O feed permanece carregando porque a chamada não tem prazo de expiração.

## Correção aplicada

As chamadas Combflow e HiveSense usam `fetchJsonWithTimeout`, com prazo de **10 segundos por requisição**, incluindo a leitura do JSON (até 20 segundos para as duas etapas sequenciais). A lista de idiomas também expira e retorna os idiomas predefinidos em caso de falha.

Discover encaminha um `AbortSignal` tanto na carga inicial quanto na paginação, e cancela a consulta anterior ao atualizar, trocar filtros ou sair da página. O controle de geração impede que resultados antigos substituam o feed atual. Uma nova consulta também libera o estado de paginação anterior.

Timeouts chegam ao estado de erro e encerram o carregamento. O botão **Retry** existente permite carregar novamente. Falhas de paginação também aparecem no banner; o título foi ajustado para não atribuir falhas de Combflow/HiveSense ao RPC.

## Verificação

[`src/services/combflowApi.test.ts`](../src/services/combflowApi.test.ts) simula timeout e cancelamento em **cada uma das duas etapas**, verifica nova carga bem-sucedida após timeout e fallback da lista de idiomas. [`src/services/http.test.ts`](../src/services/http.test.ts) cobre cabeçalhos e corpo JSON travados, cancelamento antes de iniciar, resposta normal, erro HTTP e limpeza dos timers. A integração de cancelamento/erro/Retry no componente foi conferida no código; os testes automatizados não simulam a interação visual com o botão.
