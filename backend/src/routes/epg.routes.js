import express from 'express';
import { getEPG, getEPGWeek } from '../controllers/epg.controller.js';

const router = express.Router();

router.get('/', getEPG);
router.get('/week', getEPGWeek);

export default router;
