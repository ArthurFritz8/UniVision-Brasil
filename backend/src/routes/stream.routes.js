import express from 'express';
import { getStreamUrl, proxyStream, fetchStreamResource, validateStream } from '../controllers/stream.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { streamLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Mint a short-lived playback URL (requires login)
router.get('/:type/:id', streamLimiter, protect, getStreamUrl);

// Proxy the actual stream bytes using the short-lived token (video tags can't send Authorization headers)
router.get('/proxy/:type/:id', streamLimiter, proxyStream);

// Fetch HLS segments/keys (token-gated) after playlist rewrite
router.get('/fetch', streamLimiter, fetchStreamResource);
router.post('/validate', protect, authorize('admin'), validateStream);

export default router;
