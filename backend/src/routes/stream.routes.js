import express from 'express';
import { getStreamUrl, validateStream } from '../controllers/stream.controller.js';
import { optionalAuth, protect, authorize } from '../middleware/auth.middleware.js';
import { streamLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/:type/:id', streamLimiter, optionalAuth, getStreamUrl);
router.post('/validate', protect, authorize('admin'), validateStream);

export default router;
