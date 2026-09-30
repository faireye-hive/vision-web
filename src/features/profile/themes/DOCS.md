# Documentação de Temas do Perfil

Agora cada tema é um arquivo separado que você pode editar livremente usando **HTML (JSX)** e **Tailwind CSS**.

## Como Editar um Tema Existente
1. Vá para a pasta `src/features/profile/themes/`.
2. Abra o arquivo do tema que deseja modificar (ex: `tech.tsx`, `default.tsx`).
3. Dentro da função `Layout`, você encontrará o código HTML que define a estrutura do perfil.
4. Você pode adicionar novas `div`s, mudar classes do Tailwind, ou reorganizar os componentes.

## Como Criar um Novo Tema
1. Crie um novo arquivo `.tsx` na pasta `themes/`.
2. Copie a estrutura de um tema existente.
3. Defina seu próprio `id`, `name` e `Layout`.
4. Adicione o seu novo tema no array `PROFILE_THEMES` dentro de `src/features/profile/themes/index.ts`.

## Suporte a Modo Claro e Escuro
Os temas usam as classes do Tailwind para alternar entre os modos.
- Use classes normais para o modo claro (ex: `bg-white text-black`).
- Use o prefixo `dark:` para o modo escuro (ex: `dark:bg-slate-900 dark:text-white`).

O sistema detecta automaticamente o tema global do aplicativo e aplica as classes corretas no seu layout.

## Controle Total (Full Source)
Os temas agora são "Full Source", o que significa que **todo o HTML do perfil está dentro do arquivo do tema**.

Você não precisa mais procurar outros arquivos para mudar:
- Como os posts aparecem (Post Cards).
- Como o Header é estruturado.
- Onde os botões de seguir ficam.
- A barra de progresso de mana/voting power.

### Exemplo de Edição:
Se você quiser mudar a cor do título de um post no tema `default.tsx`, procure pela tag `<h4>` dentro da função `ThemeFeed` e altere as classes do Tailwind:
```tsx
<h4 className="text-xl font-black text-gray-900 dark:text-white ...">
  {post.title}
</h4>
```

### Componentes Base vs HTML Puro
Embora existam componentes prontos como `<ProfileHeaderSection />`, os temas `default.tsx` e `tech.tsx` agora usam **HTML Puro (JSX)** para que você tenha liberdade total de redesenhar o profile do zero.

## Dados Disponíveis (props)
Cada layout recebe um objeto `props` com tudo o que você precisa:
- `account`: Dados brutos da conta Hive.
- `posts`: Lista de postagens filtradas.
- `reputation`: Reputação calculada (ex: 65).
- `votingPower`: Porcentagem de mana (0-100).
- `followerCount` / `followingCount`: Números de seguidores.
- `isOwner`: Booleano se o visitante é o dono do perfil.
- `onSelectPost`: Função para abrir um post ao clicar.
