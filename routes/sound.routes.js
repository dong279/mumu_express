const express = require('express');
const router = express.Router();
const soundAnalysisController = require('../controllers/soundAnalysisController');
const { authenticateToken } = require('../middlewares/auth');
const { verifyAiWebhook } = require('../middlewares/aiWebhook');
const { singleAudio } = require('../config/upload');

router.post('/', authenticateToken, singleAudio, soundAnalysisController.create);
router.get('/', authenticateToken, soundAnalysisController.list);
router.get('/:analysisId', authenticateToken, soundAnalysisController.getById);
router.put('/:analysisId/result', verifyAiWebhook, soundAnalysisController.receiveResult);

module.exports = router;
