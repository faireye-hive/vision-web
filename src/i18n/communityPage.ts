const en = {
  directory: 'Communities', posts: 'Posts', about: 'About', members: 'Members', team: 'Community team',
  join: 'Join community', joined: 'Joined', leave: 'Leave community', saving: 'Saving…', publish: 'Create a post',
  share: 'Copy community link', copied: 'Link copied', copyFallback: 'Copy this link to share the community.',
  public: 'Public community', sensitive: 'Sensitive content', authors: 'Active authors', subscribers: 'Members',
  guidelines: 'Community guidelines', details: 'Community details', created: 'Created', language: 'Language', account: 'Community account',
  pinnedPosts: 'Pinned posts', pinned: 'Pinned',
  noAbout: 'This community has not added a description yet.', noRules: 'The community has not published additional guidelines.',
  teamHint: 'The people who look after this community.', seeTeam: 'Meet the team', owner: 'Owner', admin: 'Admin', mod: 'Moderator', member: 'Member',
  memberHint: 'People subscribed to this community on Hive.', noMembers: 'No members to show yet.', loadMore: 'Load more members',
  loading: 'Loading community…', loadingMembers: 'Loading members…', retry: 'Try again', error: 'Could not load this community.',
  invalid: 'Community not found', invalidHint: 'Check the community address or browse the community directory.',
  memberError: 'Could not load members. You can try again.', topics: 'Community topics', discover: 'Explore communities',
};
type Copy = Record<keyof typeof en, string>;
const pt: Copy = {
  directory: 'Comunidades', posts: 'Publicações', about: 'Sobre', members: 'Membros', team: 'Equipe da comunidade',
  join: 'Participar', joined: 'Participando', leave: 'Sair da comunidade', saving: 'Salvando…', publish: 'Criar publicação',
  share: 'Copiar link da comunidade', copied: 'Link copiado', copyFallback: 'Copie este link para compartilhar a comunidade.',
  public: 'Comunidade pública', sensitive: 'Conteúdo sensível', authors: 'Autores ativos', subscribers: 'Membros',
  guidelines: 'Regras da comunidade', details: 'Detalhes da comunidade', created: 'Criada em', language: 'Idioma', account: 'Conta da comunidade',
  pinnedPosts: 'Publicações fixadas', pinned: 'Fixada',
  noAbout: 'Esta comunidade ainda não adicionou uma descrição.', noRules: 'A comunidade não publicou regras adicionais.',
  teamHint: 'As pessoas que cuidam desta comunidade.', seeTeam: 'Conheça a equipe', owner: 'Proprietário', admin: 'Administrador', mod: 'Moderador', member: 'Membro',
  memberHint: 'Pessoas inscritas nesta comunidade na Hive.', noMembers: 'Nenhum membro para mostrar ainda.', loadMore: 'Carregar mais membros',
  loading: 'Carregando comunidade…', loadingMembers: 'Carregando membros…', retry: 'Tentar novamente', error: 'Não foi possível carregar esta comunidade.',
  invalid: 'Comunidade não encontrada', invalidHint: 'Confira o endereço ou explore o diretório de comunidades.',
  memberError: 'Não foi possível carregar os membros. Tente novamente.', topics: 'Assuntos da comunidade', discover: 'Explorar comunidades',
};
const es: Copy = {
  directory: 'Comunidades', posts: 'Publicaciones', about: 'Acerca de', members: 'Miembros', team: 'Equipo de la comunidad',
  join: 'Unirse', joined: 'Miembro', leave: 'Salir de la comunidad', saving: 'Guardando…', publish: 'Crear publicación',
  share: 'Copiar enlace de la comunidad', copied: 'Enlace copiado', copyFallback: 'Copia este enlace para compartir la comunidad.',
  public: 'Comunidad pública', sensitive: 'Contenido sensible', authors: 'Autores activos', subscribers: 'Miembros',
  guidelines: 'Reglas de la comunidad', details: 'Detalles de la comunidad', created: 'Creada', language: 'Idioma', account: 'Cuenta de la comunidad',
  pinnedPosts: 'Publicaciones fijadas', pinned: 'Fijada',
  noAbout: 'Esta comunidad aún no tiene descripción.', noRules: 'La comunidad no ha publicado reglas adicionales.',
  teamHint: 'Las personas que cuidan de esta comunidad.', seeTeam: 'Conoce al equipo', owner: 'Propietario', admin: 'Administrador', mod: 'Moderador', member: 'Miembro',
  memberHint: 'Personas suscritas a esta comunidad en Hive.', noMembers: 'Todavía no hay miembros para mostrar.', loadMore: 'Cargar más miembros',
  loading: 'Cargando comunidad…', loadingMembers: 'Cargando miembros…', retry: 'Reintentar', error: 'No se pudo cargar esta comunidad.',
  invalid: 'Comunidad no encontrada', invalidHint: 'Comprueba la dirección o explora el directorio de comunidades.',
  memberError: 'No se pudieron cargar los miembros. Inténtalo de nuevo.', topics: 'Temas de la comunidad', discover: 'Explorar comunidades',
};
export function communityPageCopy(locale: string): Copy { return locale === 'pt' ? pt : locale === 'es' ? es : en; }
export type CommunityPageCopy = Copy;
