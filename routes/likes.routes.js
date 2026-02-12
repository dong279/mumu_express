const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/community/:communityId', authenticateToken, likeController.toggleCommunityLike);
router.post('/comment/:commentId', authenticateToken, likeController.toggleCommentLike);

module.exports = router;
