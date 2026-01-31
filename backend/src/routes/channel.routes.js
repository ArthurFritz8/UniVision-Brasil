import express from 'express';
import {
  getChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  getFeaturedChannels
} from '../controllers/channel.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { idValidation, paginationValidation } from '../middleware/validator.js';

const router = express.Router();

// Rotas públicas
router.get('/', paginationValidation, getChannels);
router.get('/featured', getFeaturedChannels);
router.get('/:id', idValidation, getChannelById);

// Rotas admin
router.post('/', protect, authorize('admin'), createChannel);
router.put('/:id', protect, authorize('admin'), idValidation, updateChannel);
router.delete('/:id', protect, authorize('admin'), idValidation, deleteChannel);

export default router;
