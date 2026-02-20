const express = require('express');
const router = express.Router();
const phoneVerificationController = require('../controllers/phoneVerificationController');
const { authenticateToken } = require('../middlewares/auth');

// 인증 코드 발송 (로그인 불필요 - 회원가입 전에도 사용)
router.post('/send-code', phoneVerificationController.sendCode);

// 인증 코드 확인
// - 로그인 상태: 해당 유저의 phone_verified 업데이트
// - 비로그인 상태: 인증 여부만 확인 (회원가입 시 활용)
router.post('/verify-code', (req, res, next) => {
  // 토큰이 있으면 authenticateToken, 없으면 그냥 통과
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  }
  next();
}, phoneVerificationController.verifyCode);

// 인증 상태 확인 (로그인 필요)
router.get('/status', authenticateToken, phoneVerificationController.getVerificationStatus);

module.exports = router;
