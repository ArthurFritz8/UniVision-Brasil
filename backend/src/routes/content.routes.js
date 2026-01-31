import express from 'express';
import {
  getContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent
} from '../controllers/content.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { idValidation, paginationValidation } from '../middleware/validator.js';

const router = express.Router();

router.get('/', paginationValidation, getContents);
router.get('/:id', idValidation, getContentById);
router.post('/', protect, authorize('admin'), createContent);
router.put('/:id', protect, authorize('admin'), idValidation, updateContent);
router.delete('/:id', protect, authorize('admin'), idValidation, deleteContent);

export default router;
