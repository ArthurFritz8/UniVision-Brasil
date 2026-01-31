import express from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  checkFavorite
} from '../controllers/favorite.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { idValidation } from '../middleware/validator.js';

const router = express.Router();

router.use(protect);

router.get('/', getFavorites);
router.get('/check', checkFavorite);
router.post('/', addFavorite);
router.delete('/:id', idValidation, removeFavorite);

export default router;
