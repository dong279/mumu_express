const express = require('express');
const router = express.Router();
const fcmController = require('../controllers/fcmController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

// 디바이스 토큰 등록 (앱 실행 시 / 로그인 후 호출)
router.post('/token', fcmController.registerToken);

// 디바이스 토큰 삭제 (로그아웃 시 호출)
router.delete('/token', fcmController.removeToken);

module.exports = router;
