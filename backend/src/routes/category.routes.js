import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { idValidation } from '../middleware/validator.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', idValidation, getCategoryById);
router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), idValidation, updateCategory);
router.delete('/:id', protect, authorize('admin'), idValidation, deleteCategory);

export default router;
