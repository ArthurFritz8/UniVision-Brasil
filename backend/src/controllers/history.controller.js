import History from '../models/History.model.js';

export const getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;
    const [history, total] = await Promise.all([
      History.find({ userId: req.user._id })
        .populate('itemId')
        .sort('-watchedAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      History.countDocuments({ userId: req.user._id })
    ]);

    res.json({
      success: true,
      data: { history },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const addHistory = async (req, res, next) => {
  try {
    const { itemType, itemId, duration, position, device } = req.body;

    // Busca ou cria registro
    let history = await History.findOne({
      userId: req.user._id,
      itemType,
      itemId
    });

    if (history) {
      history.watchedAt = new Date();
      history.position = position;
      history.duration = duration;
      history.device = device || history.device;
      history.completed = position >= duration * 0.9; // 90% = completo
      await history.save();
    } else {
      history = await History.create({
        userId: req.user._id,
        itemType,
        itemId,
        duration,
        position,
        device: device || 'web',
        completed: position >= duration * 0.9
      });
    }

    res.status(201).json({
      success: true,
      message: 'Histórico atualizado',
      data: { history }
    });
  } catch (error) {
    next(error);
  }
};

export const clearHistory = async (req, res, next) => {
  try {
    await History.deleteMany({ userId: req.user._id });

    res.json({
      success: true,
      message: 'Histórico limpo com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

export const getContinueWatching = async (req, res, next) => {
  try {
    const history = await History.find({
      userId: req.user._id,
      completed: false,
      position: { $gt: 0 }
    })
      .populate('itemId')
      .sort('-watchedAt')
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    next(error);
  }
};
