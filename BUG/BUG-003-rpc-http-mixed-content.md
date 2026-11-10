# BUG-003 — nó RPC HTTP não funciona em uma página HTTPS

- **Gravidade:** P2
- **Área:** cadastro de nó RPC personalizado
- **Estado:** corrigido em 2026-11-10 (neste worktree)

## Evidência

Na versão auditada (`9def108`), `addCustomHiveNode` em [`src/services/hiveApi.ts`](../src/services/hiveApi.ts) aceitava e salvava URLs HTTP. Os formulários testavam conectividade antes de salvar, mas sem validar mixed content: `pingNode` tentava enviar a requisição que o navegador bloquearia. Um nó HTTP previamente salvo também podia ser selecionado na inicialização.

## Impacto

Quando o app estiver publicado por HTTPS, o navegador bloqueia `fetch` para RPC HTTP como mixed content. Assim, um endereço que a interface aceita não consegue passar pelo teste de conectividade; se já existir salvo, as chamadas de API também falham.

## Como reproduzir

1. Abra a versão HTTPS do app.
2. Tente adicionar um RPC `http://...` acessível.
3. O navegador bloqueia a requisição antes de obter resposta JSON-RPC e a interface informa nó inacessível.

## Correção aplicada

A validação compartilhada `getHiveNodeUrlError` rejeita HTTP quando a página está em HTTPS, com mensagem explicando que é necessário um RPC HTTPS. Navbar e modal validam antes de testar conectividade. `addCustomHiveNode` e `pingNode` também aplicam a validação diretamente.

Nós HTTP antigos ficam fora da lista utilizável em HTTPS, e uma seleção HTTP salva cai no nó padrão na inicialização. O cadastro armazenado é preservado, permitindo uso em uma sessão servida por HTTP, como o desenvolvimento local.

## Verificação

[`src/services/hiveApi.test.ts`](../src/services/hiveApi.test.ts) simula origem HTTPS e confirma que HTTP é rejeitado antes de `fetch` ou gravação; também cobre nós HTTP persistidos, fallback da seleção, protocolos inválidos e uso de `http://localhost:8090` numa página HTTP.
