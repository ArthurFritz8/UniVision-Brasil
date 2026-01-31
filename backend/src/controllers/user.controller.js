import User from '../models/User.model.js';
import { cacheDel } from '../config/redis.js';

export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, role, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: { users },
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

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, isActive, subscription } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (subscription) user.subscription = { ...user.subscription, ...subscription };

    await user.save();
    await cacheDel(`user:${id}`);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    await cacheDel(`user:${id}`);

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

export const getUserStats = async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
          free: { $sum: { $cond: [{ $eq: ['$subscription.plan', 'free'] }, 1, 0] } },
          premium: { $sum: { $cond: [{ $eq: ['$subscription.plan', 'premium'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: { stats: stats[0] || {} }
    });
  } catch (error) {
    next(error);
  }
};
