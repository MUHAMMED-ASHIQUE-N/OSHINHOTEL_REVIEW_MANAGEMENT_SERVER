import express from 'express';
import { generateToken } from '../controllers/tokenController';
// Note: This route is protected, but the protection is applied in server.ts

const router = express.Router();

router.post('/generate', generateToken);

export default router;