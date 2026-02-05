import { categoriesAPI, channelsAPI, contentAPI } from '@services/api';
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
  const {
    liveLimit = 60,
    vodLimit = 60,
    seriesLimit = 60,
  } = opts;

  const startedAt = Date.now();
  logger.debug('warmup.start', { liveLimit, vodLimit, seriesLimit });

  try {
    const [liveCats, vodCats, seriesCats] = await Promise.allSettled([
      categoriesAPI.getAll({ type: 'live' }),
      categoriesAPI.getAll({ type: 'vod' }),
      categoriesAPI.getAll({ type: 'series' }),
    ]);

    const liveCategory = pickDefaultCategory(liveCats.status === 'fulfilled' ? liveCats.value?.categories : []);
    const vodCategory = pickDefaultCategory(vodCats.status === 'fulfilled' ? vodCats.value?.categories : []);
    const seriesCategory = pickDefaultCategory(seriesCats.status === 'fulfilled' ? seriesCats.value?.categories : []);

    const tasks = [
      channelsAPI.getAll({ category: liveCategory, limit: liveLimit }),
      contentAPI.getAll({ type: 'movie', category: vodCategory, limit: vodLimit }),
      contentAPI.getAll({ type: 'series', category: seriesCategory, limit: seriesLimit }),
    ];

    const results = await Promise.allSettled(tasks);

    const summary = {
      liveOk: results[0].status === 'fulfilled',
      vodOk: results[1].status === 'fulfilled',
      seriesOk: results[2].status === 'fulfilled',
      ms: Date.now() - startedAt,
    };

    logger.debug('warmup.done', summary);
    return summary;
  } catch (err) {
    logger.warn('warmup.failed', { ms: Date.now() - startedAt, message: err?.message });
    return { ok: false, ms: Date.now() - startedAt };
  }
};
