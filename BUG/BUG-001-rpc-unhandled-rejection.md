# BUG-001 — rejeição RPC não tratada pela Promise de limpeza

- **Gravidade:** P2
- **Área:** Hive JSON-RPC
- **Estado:** corrigido em 2026-11-10 (neste worktree)

## Evidência

Na versão auditada (`9def108`), `hiveRpcCall` em [`src/services/hiveApi.ts`](../src/services/hiveApi.ts) chamava `promise.finally(...)` e ignorava a Promise devolvida. Se o RPC falhasse, essa Promise derivada também rejeitava sem handler, mesmo quando o chamador tratava a rejeição original.

## Impacto

Falhas normais de rede ou RPC podem gerar `unhandledrejection` no navegador e erros extras no console/telemetria, além do erro já tratado pelo componente. Isso dificulta distinguir falhas reais e pode poluir monitoramento.

## Como reproduzir

1. Configure/seleciona um nó RPC indisponível ou provoque uma chamada que falhe em todos os nós.
2. Observe a rejeição tratada pela tela e, em paralelo, o evento/aviso de Promise rejeitada sem tratamento.

## Correção aplicada

A limpeza agora usa `void promise.then(cleanup, cleanup)`. Ambos os caminhos removem a chamada do mapa sem criar uma rejeição extra; o erro original continua chegando ao chamador.

## Verificação

[`src/services/hiveApi.test.ts`](../src/services/hiveApi.test.ts) confirma que duas chamadas simultâneas compartilham a requisição que falha, que o erro pode ser tratado sem rejeição extra no ciclo seguinte e que uma nova tentativa faz outra requisição e recupera o resultado.
