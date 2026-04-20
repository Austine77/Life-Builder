import { Router } from 'express';
import { systemStatus } from '../controllers/system.controller.js';

const router = Router();

router.get('/status', systemStatus);

export default router;
