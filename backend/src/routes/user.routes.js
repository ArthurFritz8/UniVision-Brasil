import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { idValidation, paginationValidation } from '../middleware/validator.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/', paginationValidation, getUsers);
router.get('/stats', getUserStats);
router.get('/:id', idValidation, getUserById);
router.put('/:id', idValidation, updateUser);
router.delete('/:id', idValidation, deleteUser);

export default router;
