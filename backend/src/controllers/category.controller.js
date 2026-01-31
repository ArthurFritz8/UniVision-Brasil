import Category from '../models/Category.model.js';
import { cacheGet, cacheSet, cacheDel, CACHE_TTL } from '../config/redis.js';

export const getCategories = async (req, res, next) => {
  try {
    const { type, includeInactive } = req.query;

    const cacheKey = `categories:${type || 'all'}:${includeInactive || false}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const filter = {};
    if (type) filter.type = type;
    if (!includeInactive) filter.isActive = true;

    const categories = await Category.find(filter)
      .populate('subcategories')
      .sort('order')
      .lean();

    const result = { data: { categories } };
    await cacheSet(cacheKey, result, CACHE_TTL.CATEGORIES);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `category:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    const category = await Category.findById(id)
      .populate('subcategories');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    await cacheSet(cacheKey, { category }, CACHE_TTL);
    res.json({ success: true, data: { category } });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    await cacheDel('categories:*');
    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    await cacheDel(`category:${id}`);
    await cacheDel('categories:*');

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    await cacheDel(`category:${id}`);
    await cacheDel('categories:*');

    res.json({
      success: true,
      message: 'Categoria deletada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};
