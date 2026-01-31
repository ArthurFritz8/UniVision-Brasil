import Channel from '../models/Channel.model.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import { logger } from '../config/logger.js';

const CACHE_TTL = 3600; // 1 hora

// @desc    Listar todos os canais
// @route   GET /api/channels
// @access  Public
export const getChannels = async (req, res, next) => {
  try {
    const { 
      category, 
      search, 
      featured, 
      premium,
      page = 1, 
      limit = 50,
      sort = '-order'
    } = req.query;

    // Monta filtro
    const filter = { isActive: true };
    if (category) filter.categoryId = category;
    if (featured) filter.isFeatured = featured === 'true';
    if (premium !== undefined) filter.isPremium = premium === 'true';
    if (search) {
      filter.$text = { $search: search };
    }

    // Tenta buscar do cache
    const cacheKey = `channels:${JSON.stringify(req.query)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        ...cached
      });
    }

    // Busca do banco
    const skip = (page - 1) * limit;
    const [channels, total] = await Promise.all([
      Channel.find(filter)
        .populate('categoryId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Channel.countDocuments(filter)
    ]);

    const result = {
      data: { channels },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Salva no cache
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter canal por ID
// @route   GET /api/channels/:id
// @access  Public
export const getChannelById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cache
    const cacheKey = `channel:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached
      });
    }

    const channel = await Channel.findById(id)
      .populate('categoryId', 'name slug');

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Canal não encontrado'
      });
    }

    // Incrementa views
    channel.metadata.views += 1;
    await channel.save();

    await cacheSet(cacheKey, { channel }, CACHE_TTL);

    res.json({
      success: true,
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Criar canal (Admin)
// @route   POST /api/channels
// @access  Private/Admin
export const createChannel = async (req, res, next) => {
  try {
    const channel = await Channel.create(req.body);

    // Limpa cache
    await cacheDel('channels:*');

    logger.info(`Canal criado: ${channel.title}`);

    res.status(201).json({
      success: true,
      message: 'Canal criado com sucesso',
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Atualizar canal (Admin)
// @route   PUT /api/channels/:id
// @access  Private/Admin
export const updateChannel = async (req, res, next) => {
  try {
    const { id } = req.params;

    const channel = await Channel.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Canal não encontrado'
      });
    }

    // Limpa cache
    await cacheDel(`channel:${id}`);
    await cacheDel('channels:*');

    logger.info(`Canal atualizado: ${channel.title}`);

    res.json({
      success: true,
      message: 'Canal atualizado com sucesso',
      data: { channel }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deletar canal (Admin)
// @route   DELETE /api/channels/:id
// @access  Private/Admin
export const deleteChannel = async (req, res, next) => {
  try {
    const { id } = req.params;

    const channel = await Channel.findByIdAndDelete(id);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Canal não encontrado'
      });
    }

    // Limpa cache
    await cacheDel(`channel:${id}`);
    await cacheDel('channels:*');

    logger.info(`Canal deletado: ${channel.title}`);

    res.json({
      success: true,
      message: 'Canal deletado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter canais em destaque
// @route   GET /api/channels/featured
// @access  Public
export const getFeaturedChannels = async (req, res, next) => {
  try {
    const cacheKey = 'channels:featured';
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        ...cached
      });
    }

    const channels = await Channel.find({ 
      isActive: true, 
      isFeatured: true 
    })
      .populate('categoryId', 'name slug')
      .sort('-metadata.views')
      .limit(20)
      .lean();

    const result = { data: { channels } };
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};
