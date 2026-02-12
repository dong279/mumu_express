const express = require('express');
const router = express.Router();
const behaviorAnalysisController = require('../controllers/behaviorAnalysisController');
const { authenticateToken } = require('../middlewares/auth');
const { verifyAiWebhook } = require('../middlewares/aiWebhook');
const { singleVideo } = require('../config/upload');

router.post('/', authenticateToken, singleVideo, behaviorAnalysisController.create);
router.get('/', authenticateToken, behaviorAnalysisController.list);
router.get('/:analysisId', authenticateToken, behaviorAnalysisController.getById);
router.put('/:analysisId/result', verifyAiWebhook, behaviorAnalysisController.receiveResult);

module.exports = router;
