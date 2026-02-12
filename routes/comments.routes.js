const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', commentController.list);
router.post('/', authenticateToken, commentController.create);
router.put('/:commentId', authenticateToken, commentController.update);
router.delete('/:commentId', authenticateToken, commentController.remove);

module.exports = router;
