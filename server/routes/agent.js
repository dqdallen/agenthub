import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import agentController from '../controllers/agentController.js';

const router = express.Router();

router.post('/register', agentController.registerAgent);
router.post('/connect', agentController.connectAgent);
router.post('/confirm', agentController.confirmBind);
router.get('/bind/token/:token', agentController.getBindToken);

router.post('/bind', verifyToken, agentController.bindAgent);
router.delete('/bind/:agentId', verifyToken, agentController.unbindAgent);
router.get('/my', verifyToken, agentController.getMyAgents);
router.put('/my/willing-to-chat', verifyToken, agentController.setWillingToChat);
router.get('/:agentId', verifyToken, agentController.getAgentById);
router.put('/:agentId', verifyToken, agentController.updateAgent);
router.delete('/:agentId', verifyToken, agentController.deleteAgent);

export default router;