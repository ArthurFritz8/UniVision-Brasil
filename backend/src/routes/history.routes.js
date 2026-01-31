import express from 'express';
import {
  getHistory,
  addHistory,
  clearHistory,
  getContinueWatching
} from '../controllers/history.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { paginationValidation } from '../middleware/validator.js';

const router = express.Router();

router.use(protect);

router.get('/', paginationValidation, getHistory);
router.get('/continue', getContinueWatching);
router.post('/', addHistory);
router.delete('/', clearHistory);

export default router;
