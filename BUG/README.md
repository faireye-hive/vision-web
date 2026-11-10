# Auditoria de bugs — Nebulosa Web

Auditoria original: 2026-11-10 · base `9def108` (`main`)

Revisão e correções: 2026-11-10 · aplicadas neste worktree.

Os quatro registros foram revisados e os quatro problemas foram confirmados e corrigidos. Os arquivos `BUG-*.md` preservam o diagnóstico original e registram a solução aplicada e sua verificação.

## Achados

| ID | Gravidade | Estado | Correção |
|---|---|---|---|
| [BUG-001](BUG-001-rpc-unhandled-rejection.md) | P2 | Corrigido | Limpeza da deduplicação trata sucesso e falha sem gerar rejeição extra. |
| [BUG-002](BUG-002-ping-sem-timeout.md) | P2 | Corrigido | Pings expiram em 5 s e compartilham requisições simultâneas para a mesma URL. |
| [BUG-003](BUG-003-rpc-http-mixed-content.md) | P2 | Corrigido | Validação antes do ping/cadastro e exclusão de nós HTTP antigos da lista utilizável em HTTPS. |
| [BUG-004](BUG-004-discovery-sem-timeout.md) | P2 | Corrigido | Timeout de 10 s por requisição, cancelamento e erro recuperável com Retry. |

## Cobertura da auditoria original

- Interface: leitor de post em desktop `1304×886`; leitor de post e editor em mobile `390×844`; Shorts e painel de filtros em mobile `390×844`.
- Nas páginas verificadas, `document.documentElement.scrollWidth` não excedeu a largura do viewport; não reproduzi corte horizontal nesses fluxos.
- O painel de filtros e as opções de publicação ficaram acessíveis dentro do viewport mobile. As categorias do editor continuaram disponíveis sem comunidade selecionada.
- Camada de API: inspeção de `hiveApi.ts`, `apiCache.ts`, `combflowApi.ts`, `Navbar.tsx` e `DiscoverPage.tsx`.
- Verificação da base auditada: `npm run lint` passou; `npx vitest run` passou com 70 testes em 12 arquivos.

## Verificação das correções

- Foram adicionados 15 testes de regressão em `src/services/http.test.ts`, `src/services/hiveApi.test.ts` e `src/services/combflowApi.test.ts`, com rede simulada e relógio controlado.
- Os cenários incluem falha RPC tratada, deduplicação e recuperação, conexões e corpos JSON travados, cancelamento, mixed content e nós HTTP salvos.
- Resultado final: `npx vitest run` passou com **85 testes em 15 arquivos**; `npm run lint`, `npm run build` e `git diff --check` passaram. O build mantém o aviso de chunks maiores que 500 kB já observado na auditoria original.
- O estado de erro/Retry e o cancelamento na página Discover foram conferidos no código; não foi simulada interação visual com Retry em uma falha de rede.

O levantamento original foi feito por inspeção de código e amostras de interface. A revisão cobre os quatro registros desta pasta; não certifica todas as rotas, dispositivos ou serviços externos.
