const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.post('/', petController.create);
router.get('/', petController.list);
router.get('/:petId', petController.getById);
router.put('/:petId', petController.update);
router.delete('/:petId', petController.remove);

module.exports = router;
