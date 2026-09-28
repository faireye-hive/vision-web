import { hiveRpcCall } from './hiveApi';

export interface AccountActivityInfo {
  timestamp: number;
  dateStr: string;
  fetchedAt: number;
}

interface CacheStore {
  [username: string]: AccountActivityInfo;
}

const CACHE_KEY = 'hive_accounts_activity_cache_v1';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Piso mínimo mesmo para contas "ativas" (< 7 dias): evita bater na API de novo
// se o usuário só deu F5 ou reabriu o feed há poucos minutos. 15 min é rápido
// o bastante pra pegar post/comentário novo sem virar uma chamada por render.
const ACTIVE_MIN_REFRESH_MS = 15 * 60 * 1000;

const loadCache = (): CacheStore => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache: CacheStore) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Falha ao salvar cache de contas no LocalStorage', e);
  }
};

/**
 * Valida o cache respeitando a nova regra de atualização na abertura.
 */
function isCacheExpired(cachedItem: AccountActivityInfo): boolean {
  const now = Date.now();
  const timeSinceFetch = now - cachedItem.fetchedAt;
  const timeSinceLastActivity = now - cachedItem.timestamp;

  // ⚡ 1. Se esteve ATIVO nos últimos 7 dias:
  // Re-busca com frequência para pegar posts/comentários novinhos, mas respeita
  // um piso de ACTIVE_MIN_REFRESH_MS para não repetir a chamada a cada reabertura.
  if (timeSinceLastActivity <= 7 * DAY) {
    return timeSinceFetch > ACTIVE_MIN_REFRESH_MS;
  }

  // 2. Ativo entre 7 e 30 dias (1 mês) -> Re-busca apenas se passou mais de 24 horas
  if (timeSinceLastActivity <= 30 * DAY) {
    return timeSinceFetch > 1 * DAY;
  }

  // 3. Inativo entre 1 e 6 meses -> Re-busca a cada 3 dias
  if (timeSinceLastActivity <= 180 * DAY) {
    return timeSinceFetch > 3 * DAY;
  }

  // 4. Inativo há mais de 6 meses -> Re-busca a cada 7 dias
  return timeSinceFetch > 7 * DAY;
}

// Trava de requisições em andamento: evita que duas chamadas concorrentes
// (ex.: root feed + comments feed disparando quase ao mesmo tempo, ou o efeito
// do React rodando duas vezes) acabem batendo a mesma get_accounts duas vezes
// antes do cache ser gravado pela primeira chamada.
const pendingBatchFetches = new Map<string, Promise<void>>();

export async function getSmartAccountsActivity(
  followingUsers: string[]
): Promise<Record<string, { timestamp: number; dateStr: string }>> {
  if (!followingUsers || followingUsers.length === 0) {
    return {};
  }

  let cache = loadCache();
  const now = Date.now();
  const usersToFetch: string[] = [];

  for (const user of followingUsers) {
    const cachedItem = cache[user];

    // Se não está no cache ou se expirou (incluindo a regra dos ativos < 7 dias)
    if (!cachedItem || isCacheExpired(cachedItem)) {
      usersToFetch.push(user);
    }
  }

  if (usersToFetch.length > 0) {
    // Chave estável para este exato conjunto de usuários faltantes. Duas chamadas
    // concorrentes com o mesmo conjunto (o caso comum: mesmo observer, mesma lista
    // de seguidos) reaproveitam a mesma Promise em vez de duplicar a requisição.
    const batchKey = usersToFetch.slice().sort().join(',');

    let batchPromise = pendingBatchFetches.get(batchKey);

    if (!batchPromise) {
      batchPromise = (async () => {
        const chunkSize = 15;
        const chunks: string[][] = [];

        for (let i = 0; i < usersToFetch.length; i += chunkSize) {
          chunks.push(usersToFetch.slice(i, i + chunkSize));
        }

        try {
          const results = await Promise.all(
            chunks.map(chunk =>
              hiveRpcCall<Array<{ name: string; last_post?: string }>>(
                'condenser_api.get_accounts',
                [chunk]
              ).catch(() => [])
            )
          );

          // Recarrega o cache do disco aqui dentro (não usa a variável `cache` externa),
          // pois outra chamada pode ter escrito nele enquanto esta requisição rodava.
          const freshCache = loadCache();

          for (const accounts of results) {
            for (const acc of accounts || []) {
              if (acc.name) {
                let timestamp = 0;
                let dateStr = '1970-01-01T00:00:00';

                if (acc.last_post && acc.last_post !== '1970-01-01T00:00:00') {
                  const safeStr = acc.last_post.endsWith('Z') ? acc.last_post : `${acc.last_post}Z`;
                  const parsedTime = new Date(safeStr).getTime();
                  if (!isNaN(parsedTime)) {
                    timestamp = parsedTime;
                    dateStr = acc.last_post;
                  }
                }

                freshCache[acc.name] = {
                  timestamp,
                  dateStr,
                  fetchedAt: now
                };
              }
            }
          }

          saveCache(freshCache);
        } catch (error) {
          console.error('Erro ao buscar contas no Hive API:', error);
        } finally {
          pendingBatchFetches.delete(batchKey);
        }
      })();

      pendingBatchFetches.set(batchKey, batchPromise);
    }

    await batchPromise;
    cache = loadCache(); // relê com os dados (possivelmente já gravados por outra chamada)
  }

  // Retorna os dados combinados (o que acabou de ser atualizado + o que veio do cache)
  const resultMap: Record<string, { timestamp: number; dateStr: string }> = {};
  for (const user of followingUsers) {
    if (cache[user] && cache[user].timestamp > 0) {
      resultMap[user] = {
        timestamp: cache[user].timestamp,
        dateStr: cache[user].dateStr
      };
    }
  }

  return resultMap;
}