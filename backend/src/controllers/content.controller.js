import Content from '../models/Content.model.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';

const CACHE_TTL = 3600;

export const getContents = async (req, res, next) => {
  try {
    const { 
      type, 
      category, 
      search, 
      genre,
      year,
      featured,
      page = 1, 
      limit = 50,
      sort = '-createdAt'
    } = req.query;

    const filter = { isActive: true };
    if (type) filter.type = type;
    if (category) filter.categoryId = category;
    if (genre) filter['metadata.genre'] = genre;
    if (year) filter.year = parseInt(year);
    if (featured) filter.isFeatured = featured === 'true';
    if (search) filter.$text = { $search: search };

    const cacheKey = `contents:${JSON.stringify(req.query)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const skip = (page - 1) * limit;
    const [contents, total] = await Promise.all([
      Content.find(filter)
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Content.countDocuments(filter)
    ]);

    const result = {
      data: { contents },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cacheSet(cacheKey, result, CACHE_TTL);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getContentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `content:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    const content = await Content.findById(id)
      .populate('categoryId', 'name slug');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Conteúdo não encontrado'
      });
    }

    content.metadata.views += 1;
    await content.save();

    await cacheSet(cacheKey, { content }, CACHE_TTL);
    res.json({ success: true, data: { content } });
  } catch (error) {
    next(error);
  }
};

export const createContent = async (req, res, next) => {
  try {
    const content = await Content.create(req.body);
    await cacheDel('contents:*');
    res.status(201).json({
      success: true,
      message: 'Conteúdo criado com sucesso',
      data: { content }
    });
  } catch (error) {
    next(error);
  }
};

export const updateContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const content = await Content.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Conteúdo não encontrado'
      });
    }

    await cacheDel(`content:${id}`);
    await cacheDel('contents:*');

    res.json({
      success: true,
      message: 'Conteúdo atualizado com sucesso',
      data: { content }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const content = await Content.findByIdAndDelete(id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Conteúdo não encontrado'
      });
    }

    await cacheDel(`content:${id}`);
    await cacheDel('contents:*');

    res.json({
      success: true,
      message: 'Conteúdo deletado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};
