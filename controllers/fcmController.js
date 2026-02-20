const db = require('../config/db');

function getFirebaseAdmin() {
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      if (!process.env.FIREBASE_PROJECT_ID) {
        throw new Error('Firebase 설정이 없습니다. .env에 FIREBASE_* 환경변수를 추가해주세요.');
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
    return admin;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('firebase-admin 패키지가 설치되지 않았습니다. npm install firebase-admin 실행 후 사용하세요.');
    }
    throw e;
  }
}

// ================================
// 디바이스 토큰 관리 API
// ================================

exports.registerToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fcm_token, device_type, device_name } = req.body || {};

    if (!fcm_token || !device_type)
      return res.status(400).json({ success: false, error: 'fcm_token과 device_type은 필수입니다.' });
    if (!['ios', 'android'].includes(device_type))
      return res.status(400).json({ success: false, error: 'device_type은 ios 또는 android여야 합니다.' });

    // 이미 있으면 업데이트, 없으면 삽입
    await db.query(
      `INSERT INTO device_tokens (user_id, device_type, fcm_token, device_name, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         device_type = VALUES(device_type),
         device_name = VALUES(device_name),
         is_active = 1,
         updated_at = NOW()`,
      [userId, device_type, fcm_token, device_name || null]
    );

    res.status(201).json({ success: true, message: '디바이스 토큰이 등록되었습니다.' });
  } catch (error) {
    console.error('registerToken:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};


exports.removeToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fcm_token } = req.body || {};

    if (!fcm_token)
      return res.status(400).json({ success: false, error: 'fcm_token은 필수입니다.' });

    await db.query(
      'UPDATE device_tokens SET is_active = 0 WHERE user_id = ? AND fcm_token = ?',
      [userId, fcm_token]
    );

    res.json({ success: true, message: '디바이스 토큰이 삭제되었습니다.' });
  } catch (error) {
    console.error('removeToken:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

// ================================
// 푸시 발송 유틸 함수 (내부 사용)
// ================================

/**
 * 특정 유저에게 푸시 알림 발송
 * @param {number} userId - 수신자 user_id
 * @param {object} notification - { title, body }
 * @param {object} data - 커스텀 데이터 (딥링크 등)
 */
exports.sendToUser = async (userId, notification, data = {}) => {
  try {
    const [tokens] = await db.query(
      'SELECT fcm_token FROM device_tokens WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    if (tokens.length === 0) return { sent: 0 };

    const admin = getFirebaseAdmin();
    const fcmTokens = tokens.map((t) => t.fcm_token);

    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // 유효하지 않은 토큰 비활성화
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await db.query(
        `UPDATE device_tokens SET is_active = 0 WHERE fcm_token IN (${invalidTokens.map(() => '?').join(',')})`,
        invalidTokens
      );
    }

    return { sent: response.successCount, failed: response.failureCount };
  } catch (error) {
    console.error('sendToUser FCM error:', error.message);
    return { sent: 0, error: error.message };
  }
};

/**
 * 알림 DB 저장 + 푸시 발송
 * 컨트롤러/훅에서 공통으로 호출하는 함수
 *
 * @param {number} userId
 * @param {string} type
 * @param {string} title
 * @param {string} content
 * @param {object} related 
 */
exports.notify = async (userId, type, title, content, related = {}) => {
  try {
    // 1. DB에 알림 저장
    await db.query(
      `INSERT INTO notifications (user_id, type, title, content, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, content, related.type || null, related.id || null]
    );

    // 2. 푸시 발송
    await exports.sendToUser(
      userId,
      { title, body: content },
      { type, ...(related.type && { related_type: related.type }), ...(related.id && { related_id: String(related.id) }) }
    );
  } catch (error) {
    console.error('notify error:', error.message);
  }
};

