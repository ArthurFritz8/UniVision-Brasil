import Favorite from '../models/Favorite.model.js';
import { cacheDel } from '../config/redis.js';

export const getFavorites = async (req, res, next) => {
  try {
    const { itemType } = req.query;

    const filter = { userId: req.user._id };
    if (itemType) filter.itemType = itemType;

    const favorites = await Favorite.find(filter)
      .populate('itemId')
      .sort('-createdAt')
      .lean();

    res.json({
      success: true,
      data: { favorites }
    });
  } catch (error) {
    next(error);
  }
};

export const addFavorite = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.body;

    // Verifica se já existe
    const existing = await Favorite.findOne({
      userId: req.user._id,
      itemType,
      itemId
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Item já está nos favoritos'
      });
    }

    const favorite = await Favorite.create({
      userId: req.user._id,
      itemType,
      itemId
    });

    await cacheDel(`favorites:${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Adicionado aos favoritos',
      data: { favorite }
    });
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    const { id } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorito não encontrado'
      });
    }

    await cacheDel(`favorites:${req.user._id}`);

    res.json({
      success: true,
      message: 'Removido dos favoritos'
    });
  } catch (error) {
    next(error);
  }
};

export const checkFavorite = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.query;

    const favorite = await Favorite.findOne({
      userId: req.user._id,
      itemType,
      itemId
    });

    res.json({
      success: true,
      data: { isFavorite: !!favorite }
    });
  } catch (error) {
    next(error);
  }
};
