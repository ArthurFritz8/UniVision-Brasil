import Channel from '../models/Channel.model.js';
import Content from '../models/Content.model.js';
import Category from '../models/Category.model.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const CACHE_TTL = 1800; // 30 minutos

export const search = async (req, res, next) => {
  try {
    const { q, type, page = 1, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Termo de busca deve ter no mínimo 2 caracteres'
      });
    }

    const cacheKey = `search:${q}:${type || 'all'}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const searchFilter = {
      $text: { $search: q },
      isActive: true
    };

    let results = {};
    const skip = (page - 1) * limit;

    if (!type || type === 'channels') {
      const [channels, channelsTotal] = await Promise.all([
        Channel.find(searchFilter)
          .populate('categoryId', 'name slug')
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Channel.countDocuments(searchFilter)
      ]);
      results.channels = { data: channels, total: channelsTotal };
    }

    if (!type || type === 'content') {
      const [content, contentTotal] = await Promise.all([
        Content.find(searchFilter)
          .populate('categoryId', 'name slug')
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Content.countDocuments(searchFilter)
      ]);
      results.content = { data: content, total: contentTotal };
    }

    if (!type || type === 'categories') {
      const categories = await Category.find({
        name: { $regex: q, $options: 'i' },
        isActive: true
      }).limit(10).lean();
      results.categories = { data: categories, total: categories.length };
    }

    const result = {
      data: results,
      query: q,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };

    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const searchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    const cacheKey = `suggestions:${q}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const regex = { $regex: `^${q}`, $options: 'i' };

    const [channels, content] = await Promise.all([
      Channel.find({ title: regex, isActive: true })
        .select('title')
        .limit(5)
        .lean(),
      Content.find({ title: regex, isActive: true })
        .select('title')
        .limit(5)
        .lean()
    ]);

    const suggestions = [
      ...channels.map(c => c.title),
      ...content.map(c => c.title)
    ].slice(0, 10);

    const result = { data: { suggestions } };
    await cacheSet(cacheKey, result, 600); // 10 minutos

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};
