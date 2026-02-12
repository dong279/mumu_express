const express = require('express');
const router = express.Router();
const foodSafetyController = require('../controllers/foodSafetyController');
const { authenticateToken } = require('../middlewares/auth');
const { verifyAiWebhook } = require('../middlewares/aiWebhook');
const { singleImage } = require('../config/upload');

router.post('/', authenticateToken, singleImage, foodSafetyController.create);
router.get('/', authenticateToken, foodSafetyController.list);
router.get('/:analysisId', authenticateToken, foodSafetyController.getById);
router.put('/:analysisId/result', verifyAiWebhook, foodSafetyController.receiveResult);

module.exports = router;
