const express = require('express');
const router = express.Router();
const healthCheckController = require('../controllers/healthCheckController');
const { authenticateToken } = require('../middlewares/auth');
const { verifyAiWebhook } = require('../middlewares/aiWebhook');

router.post('/', authenticateToken, healthCheckController.create);
router.get('/', authenticateToken, healthCheckController.list);
router.get('/:checkId', authenticateToken, healthCheckController.getById);
router.put('/:checkId/result', verifyAiWebhook, healthCheckController.receiveResult);

module.exports = router;
