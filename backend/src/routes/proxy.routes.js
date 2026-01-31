import express from 'express';
import { proxyRequest } from '../controllers/proxy.controller.js';
import { streamLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', streamLimiter, proxyRequest);

export default router;
