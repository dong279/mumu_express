const db = require('../config/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/jwt');

const isId = (v) => typeof v === 'string' && v.length >= 3 && v.length <= 50;
const isPassword = (v) => typeof v === 'string' && v.length >= 8;
const isPhone = (v) => !v || /^[0-9+\-]{7,20}$/.test(v);

/** 회원가입 */
exports.register = async (req, res) => {
  try {
    const {
      id, password, name, phone, address, detail_address, postal_code,
      terms_agreed, privacy_agreed, marketing_agreed
    } = req.body || {};

    if (!id || !password || !name)
      return res.status(400).json({ success: false, error: '아이디, 비밀번호, 이름은 필수입니다.' });
    if (!isId(id))
      return res.status(400).json({ success: false, error: '아이디는 3~50자 사이여야 합니다.' });
    if (!isPassword(password))
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    if (!isPhone(phone))
      return res.status(400).json({ success: false, error: '전화번호 형식이 올바르지 않습니다.' });
    if (terms_agreed === false || privacy_agreed === false)
      return res.status(400).json({ success: false, error: '필수 약관 동의가 필요합니다.' });

    const [existing] = await db.query('SELECT user_id FROM users WHERE id = ?', [id]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, error: '이미 사용 중인 아이디입니다.' });

    if (phone) {
      const [phoneExists] = await db.query('SELECT user_id FROM users WHERE phone = ?', [phone]);
      if (phoneExists.length > 0)
        return res.status(409).json({ success: false, error: '이미 등록된 전화번호입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (
        id, password, name, phone, address, detail_address, postal_code,
        terms_agreed, terms_agreed_at, privacy_agreed, privacy_agreed_at,
        marketing_agreed, marketing_agreed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, hashedPassword, name, phone || null, address || null,
        detail_address || null, postal_code || null,
        !!terms_agreed, terms_agreed ? new Date() : null,
        !!privacy_agreed, privacy_agreed ? new Date() : null,
        !!marketing_agreed, marketing_agreed ? new Date() : null
      ]
    );

    const token = generateToken(result.insertId);
    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      token,
      user: { userId: result.insertId, id, name, phone: phone || null }
    });
  } catch (error) {
    console.error('register:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 로그인 */
exports.login = async (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password)
      return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });
    if (!isId(id))
      return res.status(400).json({ success: false, error: '아이디는 3~50자 사이여야 합니다.' });
    if (!isPassword(password))
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });

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
    const token = generateToken(user.user_id);

    res.json({
      success: true,
      message: '로그인 성공',
      token,
      user: {
        userId: user.user_id, id: user.id, name: user.name,
        phone: user.phone, profileImage: user.profile_image, role: user.role
      }
    });
  } catch (error) {
    console.error('login:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 프로필 조회 */
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT user_id, id, name, phone, phone_verified, profile_image,
       address, detail_address, postal_code, role, status,
       follower_count, following_count, community_count,
       created_at, last_login_at
       FROM users WHERE user_id = ? AND (deleted_at IS NULL)`,
      [req.user.userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getProfile:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 프로필 수정 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, address, detail_address, postal_code, profile_image } = req.body || {};

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (detail_address !== undefined) { updates.push('detail_address = ?'); values.push(detail_address); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); values.push(postal_code); }
    if (profile_image !== undefined) { updates.push('profile_image = ?'); values.push(profile_image); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, error: '수정할 필드를 입력해주세요.' });

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, values);

    const [rows] = await db.query(
      'SELECT user_id, id, name, phone, profile_image, address, detail_address, postal_code FROM users WHERE user_id = ?',
      [userId]
    );
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('updateProfile:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

// ================================
// 1. 회원 탈퇴
// ================================
/** 회원 탈퇴 (소프트 삭제) - DELETE /api/users/me */
exports.withdraw = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password, reason } = req.body || {};

    if (!password)
      return res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' });

    // 비밀번호 확인
    const [users] = await db.query('SELECT password FROM users WHERE user_id = ? AND (deleted_at IS NULL)', [userId]);
    if (users.length === 0)
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });

    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid)
      return res.status(401).json({ success: false, error: '비밀번호가 올바르지 않습니다.' });

    // 소프트 삭제: deleted_at 설정, 개인정보 마스킹
    await db.query(
      `UPDATE users SET
        deleted_at = NOW(),
        delete_reason = ?,
        status = 'inactive',
        phone = NULL,
        address = NULL,
        detail_address = NULL,
        postal_code = NULL,
        profile_image = NULL
       WHERE user_id = ?`,
      [reason || null, userId]
    );

    // 리프레시 토큰 전부 폐기
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);

    // FCM 디바이스 토큰 비활성화
    await db.query('UPDATE device_tokens SET is_active = 0 WHERE user_id = ?', [userId]);

    res.json({ success: true, message: '회원 탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('withdraw:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

// ================================
// 2. 비밀번호 변경 / 재설정
// ================================
/** 비밀번호 변경 (로그인 상태) - PUT /api/users/password */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password)
      return res.status(400).json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    if (!isPassword(new_password))
      return res.status(400).json({ success: false, error: '새 비밀번호는 최소 8자 이상이어야 합니다.' });
    if (current_password === new_password)
      return res.status(400).json({ success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' });

    const [users] = await db.query('SELECT password FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0)
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });

    const valid = await bcrypt.compare(current_password, users[0].password);
    if (!valid)
      return res.status(401).json({ success: false, error: '현재 비밀번호가 올바르지 않습니다.' });

    const hashed = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, userId]);

    // 다른 기기 리프레시 토큰 폐기 (보안)
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);

    res.json({ success: true, message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' });
  } catch (error) {
    console.error('changePassword:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 비밀번호 재설정 토큰 발급 (로그아웃 상태) - POST /api/users/password-reset/request */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone)
      return res.status(400).json({ success: false, error: '전화번호를 입력해주세요.' });

    const [users] = await db.query(
      'SELECT user_id FROM users WHERE phone = ? AND (deleted_at IS NULL)',
      [phone]
    );
    // 보안상 존재 여부와 관계없이 동일 응답
    if (users.length === 0) {
      return res.json({ success: true, message: '해당 전화번호로 인증 코드를 발송했습니다.' });
    }

    const userId = users[0].user_id;
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30분

    // 기존 토큰 무효화
    await db.query('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0', [userId]);

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );

    // TODO: SMS 발송 (coolsms 등 연동 시 여기서 phone으로 token 전송)
    // 개발 환경에서는 응답에 토큰 포함 (운영에서는 제거)
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      success: true,
      message: '해당 전화번호로 인증 코드를 발송했습니다.',
      ...(isDev && { dev_token: token })
    });
  } catch (error) {
    console.error('requestPasswordReset:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 비밀번호 재설정 실행 - POST /api/users/password-reset/confirm */
exports.confirmPasswordReset = async (req, res) => {
  try {
    const { token, new_password } = req.body || {};

    if (!token || !new_password)
      return res.status(400).json({ success: false, error: 'token과 new_password는 필수입니다.' });
    if (!isPassword(new_password))
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });

    const [tokens] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (tokens.length === 0)
      return res.status(400).json({ success: false, error: '유효하지 않거나 만료된 토큰입니다.' });

    const { password_reset_token_id, user_id } = tokens[0];
    const hashed = await bcrypt.hash(new_password, 12);

    await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, user_id]);
    await db.query('UPDATE password_reset_tokens SET used = 1 WHERE password_reset_token_id = ?', [password_reset_token_id]);

    // 모든 리프레시 토큰 폐기
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [user_id]);

    res.json({ success: true, message: '비밀번호가 재설정되었습니다.' });
  } catch (error) {
    console.error('confirmPasswordReset:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 사용자 차단 */
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedId = parseInt(req.params.userId, 10);

    if (!blockedId || Number.isNaN(blockedId))
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    if (blockerId === blockedId)
      return res.status(400).json({ success: false, error: '자기 자신은 차단할 수 없습니다.' });

    const [target] = await db.query('SELECT user_id FROM users WHERE user_id = ? AND (deleted_at IS NULL)', [blockedId]);
    if (target.length === 0)
      return res.status(404).json({ success: false, error: '대상 사용자를 찾을 수 없습니다.' });

    await db.query('INSERT IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
    res.status(201).json({ success: true, message: '차단되었습니다.' });
  } catch (error) {
    console.error('blockUser:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 사용자 차단 해제 */
exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedId = parseInt(req.params.userId, 10);

    if (!blockedId || Number.isNaN(blockedId))
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });

    const [result] = await db.query('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, error: '차단 목록에서 찾을 수 없습니다.' });

    res.json({ success: true, message: '차단이 해제되었습니다.' });
  } catch (error) {
    console.error('unblockUser:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내가 차단한 사용자 목록 */
exports.getBlockedList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT u.user_id, u.id, u.name, u.profile_image, ub.created_at as blocked_at
       FROM user_blocks ub
       JOIN users u ON u.user_id = ub.blocked_id
       WHERE ub.blocker_id = ? ORDER BY ub.created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getBlockedList:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};