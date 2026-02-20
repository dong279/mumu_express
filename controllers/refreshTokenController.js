const db = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateToken } = require('../utils/jwt');

const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/** 리프레시 토큰 생성 & DB 저장 */
async function createRefreshToken(userId, deviceInfo = {}) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token, device_type, device_info, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      token,
      deviceInfo.device_type || null,
      deviceInfo.device_info ? JSON.stringify(deviceInfo.device_info) : null,
      expiresAt
    ]
  );
  return token;
}

/**
 * 로그인 시 리프레시 토큰 발급
 * 기존 loginController에서 호출하거나, 별도 엔드포인트로 사용
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const { id, password, device_type, device_info } = req.body || {};

    if (!id || !password)
      return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });

    const [users] = await db.query(
      'SELECT user_id, id, password, name, phone, profile_image, role, status FROM users WHERE id = ? AND (deleted_at IS NULL)',
      [id]
    );
    if (users.length === 0)
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    const user = users[0];
    if (user.status !== 'active')
      return res.status(403).json({ success: false, error: '비활성화된 계정입니다.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    await db.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

    const accessToken = generateToken(user.user_id);
    const refreshToken = await createRefreshToken(user.user_id, { device_type, device_info });

    res.json({
      success: true,
      message: '로그인 성공',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 60 * 60 * 24 * 7, // 7일 (초)
      user: {
        userId: user.user_id,
        id: user.id,
        name: user.name,
        phone: user.phone,
        profileImage: user.profile_image,
        role: user.role
      }
    });
  } catch (error) {
    console.error('auth login:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/**
 * 액세스 토큰 재발급
 * POST /api/auth/refresh
 * Body: { refresh_token }
 */
exports.refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body || {};

    if (!refresh_token)
      return res.status(400).json({ success: false, error: 'refresh_token이 필요합니다.' });

    // DB에서 리프레시 토큰 조회
    const [tokens] = await db.query(
      `SELECT rt.*, u.status FROM refresh_tokens rt
       JOIN users u ON u.user_id = rt.user_id
       WHERE rt.token = ? AND rt.revoked = 0 AND rt.expires_at > NOW() AND (u.deleted_at IS NULL)`,
      [refresh_token]
    );

    if (tokens.length === 0)
      return res.status(401).json({ success: false, error: '유효하지 않거나 만료된 리프레시 토큰입니다.' });

    const tokenRow = tokens[0];
    if (tokenRow.status !== 'active')
      return res.status(403).json({ success: false, error: '비활성화된 계정입니다.' });

    // 사용 시각 업데이트
    await db.query('UPDATE refresh_tokens SET last_used_at = NOW() WHERE refresh_token_id = ?', [tokenRow.refresh_token_id]);

    // 새 액세스 토큰 발급
    const newAccessToken = generateToken(tokenRow.user_id);

    res.json({
      success: true,
      access_token: newAccessToken,
      expires_in: 60 * 60 * 24 * 7
    });
  } catch (error) {
    console.error('auth refresh:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/**
 * 로그아웃 (리프레시 토큰 폐기)
 * POST /api/auth/logout
 * Body: { refresh_token }
 */
exports.logout = async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    const userId = req.user?.userId;

    if (refresh_token) {
      // 특정 토큰만 폐기
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', [refresh_token]);
    } else if (userId) {
      // 해당 유저의 모든 토큰 폐기
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
    }

    res.json({ success: true, message: '로그아웃 되었습니다.' });
  } catch (error) {
    console.error('auth logout:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/**
 * 전체 기기 로그아웃 (모든 리프레시 토큰 폐기)
 * POST /api/auth/logout-all
 */
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: '모든 기기에서 로그아웃 되었습니다.' });
  } catch (error) {
    console.error('auth logoutAll:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
