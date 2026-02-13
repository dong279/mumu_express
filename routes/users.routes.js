const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');

// 인증 불필요
router.post('/register', userController.register);
router.post('/login', userController.login);

// 인증 필요
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.post('/:userId/block', authenticateToken, userController.blockUser);
router.delete('/:userId/block', authenticateToken, userController.unblockUser);
router.get('/blocked', authenticateToken, userController.getBlockedList);
router.delete('/account', authenticateToken, userController.deleteAccount);

module.exports = router;