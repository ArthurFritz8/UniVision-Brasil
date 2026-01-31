import express from 'express';
import { 
  register, 
  login, 
  logout, 
  getMe, 
  updateProfile, 
  changePassword,
  refreshToken 
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { registerValidation, loginValidation } from '../middleware/validator.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rotas públicas
router.post('/register', registerLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/refresh', refreshToken);

// Rotas protegidas
router.use(protect);
router.get('/me', getMe);
router.post('/logout', logout);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

export default router;
