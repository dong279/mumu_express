const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', notificationController.list);
router.put('/read-all', notificationController.markAllRead);
router.put('/:notificationId/read', notificationController.markRead);

module.exports = router;
