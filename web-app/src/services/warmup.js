import { categoriesAPI, IPTV_PROXY_BASE_URL } from '@services/api';
import { logger } from '@/utils/logger';

const pickDefaultCategory = (cats) => {
  const list = Array.isArray(cats) ? cats : [];
  const preferred = list.find((c) => {
    const id = String(c?._id ?? '');
    const name = String(c?.name ?? '').toLowerCase();
    if (!id) return false;
    if (id === '0') return false;
    if (name.includes('all') || name.includes('todos')) return false;
    return true;
  });
  return (preferred?._id ?? list[0]?._id ?? null) || null;
};

export const warmupIptvCaches = async (opts = {}) => {
  const startedAt = Date.now();
  logger.debug('warmup.start');

  // Keep the proxy awake (Render free tier can sleep).
  const pingProxy = async () => {
    try {
      const u = `${IPTV_PROXY_BASE_URL}/`;
      await fetch(u, { method: 'GET', cache: 'no-store' });
      logger.debug('warmup.proxy_ping.ok');
    } catch (err) {
      logger.debug('warmup.proxy_ping.failed', { message: err?.message });
    }
  };

  try {
    await pingProxy();

    const [liveCats, vodCats, seriesCats] = await Promise.allSettled([
      categoriesAPI.getAll({ type: 'live' }),
      categoriesAPI.getAll({ type: 'vod' }),
      categoriesAPI.getAll({ type: 'series' }),
    ]);

    const summary = {
      liveCatsOk: liveCats.status === 'fulfilled',
      vodCatsOk: vodCats.status === 'fulfilled',
      seriesCatsOk: seriesCats.status === 'fulfilled',
      ms: Date.now() - startedAt,
    };

    logger.debug('warmup.done', summary);
    return summary;
  } catch (err) {
    logger.warn('warmup.failed', { ms: Date.now() - startedAt, message: err?.message });
    return { ok: false, ms: Date.now() - startedAt };
  }
};

export const warmupAll = async () => {
  return warmupIptvCaches();
};
