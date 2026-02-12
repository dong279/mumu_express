const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { authenticateToken } = require('../middlewares/auth');
const { communityMedia } = require('../config/upload');

router.get('/best', communityController.listBest);
router.get('/', communityController.list);
router.get('/:communityId', communityController.getById);
router.post('/', authenticateToken, communityMedia, communityController.create);
router.put('/:communityId', authenticateToken, communityController.update);
router.delete('/:communityId', authenticateToken, communityController.remove);
router.post('/:communityId/media', authenticateToken, communityMedia, communityController.addMedia);
router.delete('/:communityId/media/:mediaId', authenticateToken, communityController.removeMedia);

module.exports = router;
