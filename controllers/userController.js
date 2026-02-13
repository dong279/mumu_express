const db = require('../config/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/jwt');

// 이메일 형식 검증 제거 - 일반 아이디도 허용
const isId = (v) => typeof v === 'string' && v.length >= 3 && v.length <= 50;
const isPassword = (v) => typeof v === 'string' && v.length >= 8;
const isPhone = (v) => !v || /^[0-9+\-]{7,20}$/.test(v);

/** 회원가입 (실무형 검증 포함) */
exports.register = async (req, res) => {
  try {
    const {
      id,
      password,
      name,
      phone,
      address,
      detail_address,
      postal_code,
      terms_agreed,
      privacy_agreed,
      marketing_agreed
    } = req.body || {};

    // 입력 검증
    if (!id || !password || !name) {
      return res.status(400).json({ success: false, error: '아이디, 비밀번호, 이름은 필수입니다.' });
    }
    if (!isId(id)) {
      return res.status(400).json({ success: false, error: '아이디는 3~50자 사이여야 합니다.' });
    }
    if (!isPassword(password)) {
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }
    if (!isPhone(phone)) {
      return res.status(400).json({ success: false, error: '전화번호 형식이 올바르지 않습니다.' });
    }
    if (terms_agreed === false || privacy_agreed === false) {
      return res.status(400).json({ success: false, error: '필수 약관 동의가 필요합니다.' });
    }

    const [existing] = await db.query('SELECT user_id FROM users WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: '이미 사용 중인 아이디입니다.' });
    }

    if (phone) {
      const [phoneExists] = await db.query('SELECT user_id FROM users WHERE phone = ?', [phone]);
      if (phoneExists.length > 0) {
        return res.status(409).json({ success: false, error: '이미 등록된 전화번호입니다.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const termsAgreedAt = terms_agreed ? new Date() : null;
    const privacyAgreedAt = privacy_agreed ? new Date() : null;
    const marketingAgreedAt = marketing_agreed ? new Date() : null;

    const [result] = await db.query(
      `INSERT INTO users (
        id, password, name, phone, address, detail_address, postal_code,
        terms_agreed, terms_agreed_at, privacy_agreed, privacy_agreed_at,
        marketing_agreed, marketing_agreed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        hashedPassword,
        name,
        phone || null,
        address || null,
        detail_address || null,
        postal_code || null,
        !!terms_agreed,
        termsAgreedAt,
        !!privacy_agreed,
        privacyAgreedAt,
        !!marketing_agreed,
        marketingAgreedAt
      ]
    );

    const token = generateToken(result.insertId);
    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        userId: result.insertId,
        id,
        name,
        phone: phone || null
      }
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
    if (!id || !password) {
      return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });
    }
    if (!isId(id)) {
      return res.status(400).json({ success: false, error: '아이디는 3~50자 사이여야 합니다.' });
    }
    if (!isPassword(password)) {
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    const [users] = await db.query(
      'SELECT user_id, id, password, name, phone, profile_image, role, status FROM users WHERE id = ? AND (deleted_at IS NULL)',
      [id]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = users[0];
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: '비활성화된 계정입니다.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
    const token = generateToken(user.user_id);

    res.json({
      success: true,
      message: '로그인 성공',
      token,
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
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
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
    const {
      name,
      phone,
      address,
      detail_address,
      postal_code,
      profile_image
    } = req.body || {};

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (detail_address !== undefined) { updates.push('detail_address = ?'); values.push(detail_address); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); values.push(postal_code); }
    if (profile_image !== undefined) { updates.push('profile_image = ?'); values.push(profile_image); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '수정할 필드를 입력해주세요.' });
    }
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

/** 사용자 차단 */
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedId = parseInt(req.params.userId, 10);

    if (!blockedId || Number.isNaN(blockedId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ success: false, error: '자기 자신은 차단할 수 없습니다.' });
    }

    const [target] = await db.query('SELECT user_id FROM users WHERE user_id = ? AND (deleted_at IS NULL)', [blockedId]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, error: '대상 사용자를 찾을 수 없습니다.' });
    }

    await db.query(
      'INSERT IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)',
      [blockerId, blockedId]
    );
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

    if (!blockedId || Number.isNaN(blockedId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }

    const [result] = await db.query(
      'DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '차단 목록에서 찾을 수 없습니다.' });
    }
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

/** 회원 탈퇴 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password, delete_reason } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' });
    }

    // 비밀번호 확인
    const [users] = await db.query('SELECT password FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }

    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, error: '비밀번호가 올바르지 않습니다.' });
    }

    // 탈퇴 처리
    await db.query(
      'UPDATE users SET deleted_at = NOW(), delete_reason = ?, status = ? WHERE user_id = ?',
      [delete_reason || null, 'inactive', userId]
    );

    res.json({ success: true, message: '회원 탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('deleteAccount:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};