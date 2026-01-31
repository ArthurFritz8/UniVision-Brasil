import express from 'express';
import { search, searchSuggestions } from '../controllers/search.controller.js';
import { searchValidation } from '../middleware/validator.js';

const router = express.Router();

router.get('/', searchValidation, search);
router.get('/suggestions', searchSuggestions);

export default router;
