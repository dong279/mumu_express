const express = require('express');
const router = express.Router();
const healthReportController = require('../controllers/healthReportController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.post('/', healthReportController.create);
router.get('/', healthReportController.list);
router.get('/:reportId', healthReportController.getById);

module.exports = router;
