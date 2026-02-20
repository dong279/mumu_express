const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');

// 인증 불필요
router.post('/register', userController.register);
router.post('/login', userController.login); // 리프레시 토큰 미포함 기존 방식 유지

// 비밀번호 재설정 (로그인 불필요)
router.post('/password-reset/request', userController.requestPasswordReset);
router.post('/password-reset/confirm', userController.confirmPasswordReset);

// 인증 필요
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

// 1. 회원 탈퇴
router.delete('/me', authenticateToken, userController.withdraw);

// 2. 비밀번호 변경 (로그인 상태)
router.put('/password', authenticateToken, userController.changePassword);

// 차단
router.post('/:userId/block', authenticateToken, userController.blockUser);
router.delete('/:userId/block', authenticateToken, userController.unblockUser);
router.get('/blocked', authenticateToken, userController.getBlockedList);

module.exports = router;