# Estado do projeto

Cliente web da Hive, só no navegador. Não há backend, banco nem chave privada. Os dados vêm de nós JSON-RPC públicos. Assinatura e broadcast passam pela extensão Hive Keychain.

Atualizado em 2026-09-28.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit
npm run build
```

Node >= 22.12. Stack: Vite 8, React 19, TypeScript, Tailwind CSS v4, Lucide, DOMPurify.

## Árvore

```
vision-web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   ├── _redirects
│   └── assets/logo-circle.svg
├── docs/
│   └── estado.md                 # este arquivo
└── src/
    ├── main.tsx                  # monta <App> em StrictMode
    ├── App.tsx                   # casca: navbar, colunas, páginas lazy
    ├── index.css
    ├── pages/
    │   ├── DiscoverPage.tsx      # trending/hot/new e feed de comunidades
    │   ├── FeedPage.tsx          # posts de quem o usuário segue
    │   ├── ShortsPage.tsx        # lista + overlay do snap
    │   ├── CommunitiesPage.tsx   # explorar e gerenciar comunidades
    │   ├── ProfilePage.tsx
    │   ├── WritePage.tsx
    │   ├── NotificationsPage.tsx
    │   └── FollowingManagerPage.tsx
    ├── components/
    │   ├── Navbar.tsx
    │   ├── LeftSidebar.tsx
    │   ├── RightRail.tsx         # coluna da direita, conforme a aba
    │   ├── PostCard.tsx
    │   ├── PostReader.tsx        # post aberto + comentários (lazy)
    │   ├── PostSidebar.tsx
    │   ├── ShortsFeed.tsx
    │   ├── ShortCard.tsx
    │   ├── ShortDetailView.tsx
    │   ├── SafeSnapImage.tsx
    │   ├── NotificationToastHost.tsx
    │   └── …dropdowns, cards e modais
    ├── context/
    │   ├── AuthContext.tsx
    │   ├── NavigationContext.tsx
    │   ├── NotificationsContext.tsx
    │   ├── ContentFilterContext.tsx
    │   └── BookmarksContext.tsx
    ├── hooks/
    │   └── useShortsWordFilter.ts
    ├── services/
    │   ├── hiveApi.ts            # JSON-RPC, feeds, contas, discussão
    │   ├── apiCache.ts           # cache em memória + storage pequeno
    │   ├── shortsApi.ts
    │   ├── shortsCache.ts
    │   ├── accountsCache.ts
    │   ├── combflowApi.ts        # descoberta por idioma
    │   └── keychain.ts
    ├── data/
    │   ├── categorySubtopics.ts
    │   └── topCommunities.ts
    └── utils/
        ├── sanitize.ts           # DOMPurify + proxy de imagem
        ├── imageLoaderQueue.ts   # só resolve a URL protegida
        ├── contentFilter.ts
        ├── contentScoring.ts
        ├── communityTaxonomy.ts
        ├── postTags.ts
        ├── posts.ts
        ├── authEvents.ts
        └── theme.ts
```

Discover, Feed e a casca entram no primeiro download. Shorts, leitor, escrever, perfil, notificações, comunidades e o modal de estatísticas são `React.lazy`.

## Rotas

O estado de navegação espelha a URL em `NavigationContext`. Não criar um segundo lugar para a aba ativa ou o post aberto.

| URL | Tela |
|---|---|
| `/`, `/discover` | Discover. `?sort=` e `?tag=` são lidos da URL |
| `/feed` | Feed de quem você segue |
| `/shorts` | Lista de snaps |
| `/shorts/@autor/permlink` | Snap aberto por cima da lista |
| `/post/@autor/permlink` | Leitor |
| `/c/:comunidade` | Feed da comunidade. `?topic=` é o subtópico |
| `/tag/:tag` | Discover filtrado |
| `/communities`, `?tab=explore`, `?tab=manage` | Lista ou gestão |
| `/profile/@usuario` | Perfil |
| `/write` | Editor |
| `/notifications` | Caixa de notificações |
| `/following` | Gerenciador de follows |

`handleNavChange`, `openCommunity`, `handleSelectPost` e `handleClosePost` são quem escreve a URL. O efeito em `NavigationContext` só lê a URL e completa o post quando a página abre direto num link.

## Contextos

A ordem em `App` é fixa: `Auth` → `Navigation` → `Notifications` → `ContentFilter` → `Bookmarks`.

- **Auth** guarda o usuário do Keychain, a lista de follows e as comunidades assinadas.
- **Navigation** guarda aba, ordenação, tag, post aberto e páginas soltas. O valor é memoizado. Qualquer estado que muda o tempo todo não deve entrar aqui: um `setState` redesenha Discover e Feed.
- **Notifications** faz o poll de 45s, o contador e o toast. O contador compara o id com `hive_last_read_notif_id`. Não usar `notifs.length` como não lidas.
- **ContentFilter** é o mute local de palavras e autores.
- **Bookmarks** persiste em `localStorage`.

O toast fica em `NotificationToastHost`, não no `App`. O `onClose` precisa ser estável. Se ele mudar a cada render, o timer de 6s reinicia e o aviso não some.

## Hive API

`hiveRpcCall` em `src/services/hiveApi.ts` fala com o nó ativo e repete a mesma chamada em voo uma vez só. Nós padrão e nós customizados ficam no `localStorage` (`nebulosa_active_rpc_node`, `nebulosa_custom_rpc_nodes`).

`fetchWithCache` também junta chamadas iguais. Listas de posts e mapas de discussão não vão para `sessionStorage` nem `localStorage`: o corpo é grande e trava a aba. Conta, perfil e comunidade continuam persistidos, com teto de 100 KB. Durante a sessão o cache em memória vale. Depois de recarregar, o feed busca de novo.

### `bridge.get_discussion` não recebe `observer`

`getDiscussion` aceita o argumento para não quebrar chamadas antigas e o ignora. O Hivemind coloca as listas de mute e blacklist do observer dentro da query recursiva. Em algumas contas isso devolve a thread vazia ou erro, enquanto a mesma discussão sem observer carrega. Por isso:

- o leitor (`PostReader`) chama `getDiscussion(autor, permlink)` sem usuário;
- o container de Shorts (`getContainerSnaps`) faz o mesmo;
- a chave de cache é `discussion:autor:permlink`, sem o nome da conta.

Não “corrigir” isso passando `currentUser.username`. O mute da interface (`ContentFilterContext`) é uma lista local e continua valendo. Ele não é a lista de mute da blockchain.

`observer` segue válido em `bridge.get_ranked_posts` (feed `my` da comunidade) e nas contas. Isso é outro método.

### Paginação

O cursor do Discover é o último item na ordem da API (`apiCursorRef`), não o último card depois do `rankPostsByCustomAlgorithm`. Usar o card reordenado repete ou pula posts.

“Carregar mais” no feed de um autor passa `start_author` e `start_permlink` do último post. A API inclui esse post de novo. `appendUniquePosts` tira a duplicata.

## Imagens

Proteção contra arquivo disfarçado de imagem:

1. `isAllowedImageHost` em `src/utils/sanitize.ts` só deixa os domínios da lista.
2. `getSafeImageUrl` reescreve esse endereço pelo proxy `wsrv.nl` (`output=webp`). O proxy reencoda. Formato malicioso costuma falhar aí.
3. `SafeSnapImage` só coloca no `<img>` a URL que `resolveProtectedImageUrl` devolve. Se o host não está na lista, a imagem não carrega. Não existe fallback para o host original.
4. Um arquivo de 1×1 que passe pelo proxy é descartado no `onLoad`.

O HTML do post passa por DOMPurify, que aplica a mesma regra nas tags `<img>`. Não carregar a URL crua num `new Image()` só para “verificar”: isso baixa o arquivo duas vezes e quebra em CDN sem CORS.

## Shorts

Abrir um snap não pode desmontar a lista nem travar o `body` com `position: fixed`. Esse travamento zera `window.scrollY` e, no StrictMode, o efeito roda de novo e grava 0. O clique chama `onBeforeOpenDetail`, que grava a posição em `sessionStorage` (`nebulosa_shorts_scroll`) e segura o listener de scroll. O fio abre num overlay `fixed`. Ao fechar, a página volta para o valor guardado. `history.scrollRestoration` fica `manual` enquanto Shorts está montada.

O `App` não chama `restoreScrollPosition` na aba Shorts. Esse valor é 0 nessa aba e jogava a lista para o topo.

A coluna da direita tem o cartão Reading (`ReadingStyleCard`), recolhido até o clique. Tamanho, fonte, cor e ambiente ficam em `localStorage` (`nebulosa_reading_style`).

Na coluna da esquerda, em Shorts: "Snaps from following" lê o cache do feed de comentários de quem você segue (`getFollowedCommentsFeed`) e fica só com os comentários cujo pai é `@peak.snaps`. "Replies to my snaps" chama `bridge.get_account_posts` com a conta logada e `sort=replies`, e cruza com os comentários dessa mesma conta cujo pai é um snap.

## Profile Studio (Customização de Layout e Estilo)

A página de perfil possui seu próprio módulo modular em `src/features/profile/` com tipos, componentes e gaveta de edição:
- **Isolamento de escopo**: Os estilos do perfil são aplicados exclusivamente dentro de `#profile-page-container` (fontes, cores de destaque, fundo e estilo de cartões), sem alterar as variáveis globais de body/html das outras páginas.
- **8 Estruturas de Layout**: Suporta `hero-wide`, `bento-grid`, `split-columns`, `compact-centered`, `editorial-magazine`, `floating-avatar`, `sidebar-portrait` e `minimalist-canvas`.
- **Layout de Cards de Posts**: Suporte a feed em `list`, `grid-2`, `grid-3`, `magazine` e `compact`, além de posicionamento de fotos (topo, direita, esquerda ou oculta), posição do título, linhas de resumo e posição de votos.
- **Moldura de Avatar e Header**: Formato (círculo, quadrado, squircle, hexágono), anéis de Voting Power, brilhos e alturas de banner.
- **Stats e Badges Granulares**: Toggles individuais para Voting Power, HIVE/HBD/Poupança e tópicos, com variantes `cards`, `pills` ou `minimal-row`.
- **Temas por Persona**: Presets prontos apresentados como primeira aba (Jornalista, Escritor, Fotógrafo, Tech & Crypto, Artista, Anime & Gamers).
- **Personalização de Cores**: Cor de fundo sólido da página (`backgroundColor`), cor dos containers/cartões (`cardBackgroundColor`), cor do cabeçalho da foto (`headerBackgroundColor`) e cores de texto principal e secundário (`textColor`, `textSecondaryColor`).
- **Persistência na Blockchain**: O estilo é transmitido via `KeychainService.broadcastCustomJson` com o ID `nebulosa_profile_style` (chave Posting), e lido do histórico da conta para exibição pública. Ver detalhes em [docs/profile_style.md](profile_style.md).

## O que não misturar de novo

- Poll de notificação dentro de `NavigationContext`.
- Corpo de post no `localStorage` / `sessionStorage`.
- `observer` em `bridge.get_discussion`.
- URL de imagem fora do proxy e da whitelist.
- Cursor de página seguinte tirado da lista já reordenada pelo ranking.
