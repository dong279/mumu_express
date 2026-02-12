const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.post('/', reportController.create);
router.get('/', reportController.listMine);

module.exports = router;
