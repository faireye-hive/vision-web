# Customização de Layout e Estilo do Perfil (Profile Studio)

Este módulo permite aos autores da Hive personalizarem totalmente a estrutura visual, estilo e layout da sua própria página de perfil (`/profile/@usuario`), com isolamento estrito para não afetar as outras páginas da aplicação.

## Arquitetura de Pastas

```
src/
├── features/
│   └── profile/
│       ├── profileStyleTypes.ts          # Definições de tipos, esquemas, presets por persona e padrões
│       └── components/
│           ├── ProfileHeaderSection.tsx   # Banner, avatar (formatos, molduras, brilhos), VP ring e alinhamento
│           ├── ProfileBioSection.tsx      # Biografia, localização, website, seguidores e data de criação
│           ├── ProfileStatsSection.tsx    # Estatísticas com toggles granulares e modos (cards, pills, minimal)
│           ├── ProfileBadgesSection.tsx   # Tópicos e comunidades com toggles granulares e limites
│           ├── ProfileFeedSection.tsx     # CustomProfilePostCard com layout de cards, grids, títulos e votos
│           └── ProfileCustomizerDrawer.tsx# Painel lateral interativo de customização ao vivo com Temas em destaque
├── services/
│   ├── profileStyleService.ts             # Leitura e escrita no cache local e broadcast no Hive
│   └── keychain.ts                        # Integração via Hive Keychain (custom_json)
└── pages/
    └── ProfilePage.tsx                    # Orquestrador modular com injeção de layouts e estilos isolados
```

## Como Funciona

### 1. Temas Prontos por Persona (Aba Principal)
Ao abrir o **Profile Studio**, a primeira aba exibida é **Themes (Presets)**, permitindo aplicar um visual completo com 1 clique e depois personalizar detalhes:
- 📰 **Journalist & Newsroom**: Layout editorial tipo revista, títulos de manchete, sem poluição de saldos cripto, tipografia clássica serifada.
- ✍️ **Author & Novelist**: Foco em leitura, coluna centralizada sem distrações visuais ou thumbnails forçados, tipografia de livro e resumos nítidos.
- 📸 **Photographer & Gallery**: Grade em formato de galeria visual com fotos no topo de cada card, fundo escuro cinematográfico com desfoque suave.
- 💻 **Tech & Crypto Explorer**: Estilo split-screen com barra lateral, métricas on-chain ativas (Voting Power, HIVE, HBD, Poupança 15% APR), fonte monospace.
- 🎨 **Digital Artist & Creator**: Layout criativo com avatar flutuante, cartões translúcidos em vidro fosco (*frosted glass*), grade com proporções artísticas 4:3.
- 🎌 **Anime & Gaming Fan**: Estilo neon elétrico, moldura brilhante de avatar, cartões com bordas iluminadas e cores vibrantes.

### 2. Estruturas de Layout (`structure`)
- `hero-wide`: Banner largo tradicional com blocos sequenciais na ordem do autor.
- `bento-grid`: Grade moderna Bento com bio e estatísticas em caixas harmoniosas.
- `split-columns`: Sidebar lateral fixa com dados do autor e feed principal à direita.
- `compact-centered`: Coluna estreita focada em leitura minimalista.
- `editorial-magazine`: Cabeçalho de jornal/revista com manchetes e seções integradas.
- `floating-avatar`: Avatar e cartão flutuantes sobre o banner ou wallpaper.
- `sidebar-portrait`: Coluna vertical de retrato à esquerda com todo o perfil do autor, enquanto os posts fluem à direita.
- `minimalist-canvas`: Sem bordas pesadas, design puro focado em imagens e tipografia.

### 3. Cabeçalho, Avatar e Molduras (`headerConfig`)
- **Estilos de Cabeçalho**: `standard`, `card-floating`, `no-banner` (sem banner), `split-masthead` (estilo editorial).
- **Formato do Avatar**: Círculo (`circle`), Quadrado Arredondado (`rounded-square`), Squircle (`squircle`), Hexágono (`hexagon`).
- **Tamanho do Avatar**: Pequeno (`sm`), Médio (`md`), Grande (`lg`), Extra Grande (`xl`).
- **Moldura do Avatar**: Nenhuma (`none`), Anel de Destaque (`ring-accent`), Brilho Neon (`glow`), Anel Duplo (`double`).
- **Anel de Voting Power**: Alternador para exibir ou ocultar o medidor circular de mana ao redor da foto.
- **Altura do Banner**: Compacto, Normal, Alto ou Oculto.
- **Alinhamento do Cabeçalho**: Esquerda, Centro ou Direita.

### 4. Layout dos Cards de Posts (`postsLayout`)
- **Modos de Exibição do Feed**:
  - `list`: Lista clássica de 1 coluna.
  - `grid-2`: Grade moderna de 2 colunas.
  - `grid-3`: Grade ampla de 3 colunas (ideal para fotos e artes).
  - `magazine`: Estilo editorial com manchete.
  - `compact`: Linhas compactas para navegação rápida.
- **Posição da Foto do Post**: No topo (`top`), à direita (`right`), à esquerda (`left`) ou oculta (`hidden`).
- **Posição do Título**: Acima da foto (`above-image`) ou abaixo da foto (`below-image`).
- **Resumo do Post**: Alternador de exibição e seletor de linhas de corte (1, 2, 3 ou 4 linhas).
- **Posição do Botão de Voto**: Na barra inferior (`bottom`), no topo direito do card (`top-right`) ou oculto (`hidden`).
- **Tags & Payouts**: Alternadores individuais para mostrar ou ocultar as tags e o valor em HBD.

### 5. Controle Granular de Stats & Badges
- **Estatísticas Flexíveis**:
  - Cada métrica pode ser ligada ou desligada individualmente: Voting Power, Seguidores, Reputação, HIVE líquido, HBD líquido e Poupança (15% APR).
  - Variantes visuais: Cartões completos (`cards`), Fitas elegantes (`pills`) ou Linha minimalista de números (`minimal-row`).
- **Tópicos e Comunidades**:
  - Alternador independente para exibir/ocultar Tópicos e Comunidades.
  - Controle de quantidade máxima de tópicos (de 4 a 32).

### 6. Estilos de Cartão, Cores, Seletor de Cores e Modo Noturno
- **Seletor de Cor Interativo (Color Picker)**:
  - Adicionado componente `ColorPickerField` com botão interativo de conta-gotas / seletor nativo do sistema operacional (`<input type="color">`), permitindo escolher qualquer tom da roda de cores ou paleta.
  - Seletor com paletas divididas em **☀️ Tons Claros (Light)** e **🌙 Tons Escuros (Dark)**.
  - Campo de entrada direta em Hexadecimal `#xxxxxx` com validação e sincronização instantânea em tempo real.
  - Botão de **"Reset to Auto"** em cada campo para retornar ao comportamento reativo padrão do tema quando desejado.
- **Alternador Rápido de Modo Claro / Modo Noturno**:
  - Botão de pré-visualização rápida no topo do Studio e na aba de Estética permitindo alternar instantaneamente entre **☀️ Modo Claro** e **🌙 Modo Noturno** enquanto edita, para conferir a legibilidade e contraste das cores escolhidas em ambos os temas.
- **Cálculo Inteligente de Contraste Automático**:
  - Função utilitária `getSmartTextColors` que analisa a luminância perceptiva da cor de fundo (`isColorDark` via ITU-R BT.601).
  - Se o usuário definir um fundo escuro mas deixar a cor da letra em automático, o texto se ajusta imediatamente para tons claros de alta visibilidade; se definir um fundo claro, ajusta para tons escuros.
- **Remoção de Desfoque Durante a Edição**:
  - O desfoque de fundo do painel e do papel de parede é automaticamente desativado enquanto o Profile Studio estiver aberto, garantindo que o autor veja cada detalhe da sua página nítido e cristalino em tempo real.
- **Correção de Conflito de Estilo React (Shorthand / Non-Shorthand)**:
  - Eliminado o aviso do React sobre conflito entre `borderColor` e `borderTopColor`. O spinner do carregador de perfil foi substituído pelo padrão limpo `<Loader2 className="animate-spin" />`, prevenindo bugs de reconciliação de CSS entre renders.
- **Cor de Fundo da Página (`backgroundColor`)**: Opção para definir uma cor sólida para toda a página de perfil (ex: Preto puro, Deep Navy, Dark Slate, Clean Paper, etc.) quando não quiser usar uma imagem de papel de parede.
- **Cor dos Containers e Cartões (`cardBackgroundColor`)**: Personalização da cor de fundo de todas as caixas de conteúdo e cartões que exibem os textos e posts.
- **Cor do Cabeçalho (`headerBackgroundColor`)**: Cor dedicada para a área do cabeçalho com foto e nome.
- **Cor da Letra / Tipografia (`textColor` e `textSecondaryColor`)**:
  - `textColor`: Cor principal dos títulos, nomes de usuário e manchetes.
  - `textSecondaryColor`: Cor secundária para biografias, metadados, contadores e datas.
- **Estilo de Cartão**: `solid` (sólido), `glass` (vidro fosco com `backdrop-blur`) ou `outline` (apenas contorno).
- **Arredondamento**: Quadrado (`none`), Médio (`md`), Curvado (`xl`) ou Suave (`3xl`).
- **Paleta de Cores de Destaque (`accentColor`)**: 10 cores predefinidas + seletor nativo hexadecimal customizado.
- **Papel de Parede**: URL personalizada opcional, opções da galeria, controle de opacidade escura (0% a 95%) e controle de desfoque (0px a 24px).

### 7. Persistência na Blockchain Hive (`custom_json`)
Ao clicar em **"Save to Hive"**, o aplicativo transmite a operação via Keychain:
- **ID**: `nebulosa_profile_style`
- **Chave Requerida**: Posting Key
- O estilo é carregado automaticamente para qualquer visitante do perfil através do histórico da conta na Hive (`condenser_api.get_account_history`).
- O `localStorage` armazena o cache local para carregamento instantâneo.
