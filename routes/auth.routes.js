const express = require('express');
const router = express.Router();
const refreshTokenController = require('../controllers/refreshTokenController');
const { authenticateToken } = require('../middlewares/auth');

// 로그인 (리프레시 토큰 포함)
router.post('/login', refreshTokenController.login);

// 액세스 토큰 재발급
router.post('/refresh', refreshTokenController.refresh);

// 로그아웃 (현재 기기)
router.post('/logout', authenticateToken, refreshTokenController.logout);

// 전체 기기 로그아웃
router.post('/logout-all', authenticateToken, refreshTokenController.logoutAll);

module.exports = router;
