const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/search', hospitalController.search);
router.get('/prices', hospitalController.getPrices);
router.get('/favorites', authenticateToken, hospitalController.getMyFavorites);
router.get('/:hospitalId', hospitalController.getById);
router.get('/:hospitalId/reviews', hospitalController.getReviews);
router.post('/:hospitalId/reviews', authenticateToken, hospitalController.createReview);
router.post('/:hospitalId/favorites', authenticateToken, hospitalController.addFavorite);
router.delete('/:hospitalId/favorites', authenticateToken, hospitalController.removeFavorite);

module.exports = router;
