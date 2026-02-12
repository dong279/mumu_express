const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, bookmarkController.list);
router.post('/:communityId', authenticateToken, bookmarkController.toggle);

module.exports = router;
