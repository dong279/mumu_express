const db = require('../config/db');

async function sendSms(phone, code) {
  if (process.env.NODE_ENV === 'production') {
    // ── 운영 환경: 실제 SMS 발송 ──────────────────────────────────
    // 예시 (coolsms):
    // const coolsms = require('coolsms-node-sdk').default;
    // const messageService = new coolsms(process.env.SMS_API_KEY, process.env.SMS_API_SECRET);
    // await messageService.sendOne({
    //   to: phone,
    //   from: process.env.SMS_SENDER,
    //   text: `[MUMU] 인증번호: ${code} (5분 이내 입력)`
    // });
    throw new Error('SMS 서비스가 설정되지 않았습니다. .env에 SMS 설정을 추가해주세요.');
  } else {
    // ── 개발 환경: 콘솔 출력 ──────────────────────────────────────
    console.log(`[DEV SMS] phone: ${phone}, code: ${code}`);
  }
}

exports.sendCode = async (req, res) => {
  try {
    const { phone } = req.body || {};

    if (!phone || !/^[0-9+\-]{7,20}$/.test(phone))
      return res.status(400).json({ success: false, error: '올바른 전화번호를 입력해주세요.' });

    // 1분 이내 재발송 방지
    const [recent] = await db.query(
      `SELECT created_at FROM phone_verifications
       WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    if (recent.length > 0)
      return res.status(429).json({ success: false, error: '1분 후 다시 시도해주세요.' });

    // 인증 코드 생성 (6자리)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분

    await db.query(
      'INSERT INTO phone_verifications (phone, code, expires_at) VALUES (?, ?, ?)',
      [phone, code, expiresAt]
    );

    await sendSms(phone, code);

    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      success: true,
      message: '인증 코드를 발송했습니다.',
      ...(isDev && { dev_code: code }) // 개발 환경에서만 코드 응답
    });
  } catch (error) {
    console.error('sendCode:', error);
    res.status(500).json({ success: false, error: error.message || '서버 오류가 발생했습니다.' });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body || {};

    if (!phone || !code)
      return res.status(400).json({ success: false, error: '전화번호와 인증 코드를 입력해주세요.' });

    // 가장 최근 인증 시도 조회
    const [verifications] = await db.query(
      `SELECT * FROM phone_verifications
       WHERE phone = ? AND verified = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (verifications.length === 0)
      return res.status(400).json({ success: false, error: '인증 코드가 만료되었거나 존재하지 않습니다.' });

    const verification = verifications[0];

    // 시도 횟수 초과 (5회)
    if (verification.attempts >= 5) {
      await db.query('UPDATE phone_verifications SET verified = 1 WHERE phone_verification_id = ?', [verification.phone_verification_id]);
      return res.status(400).json({ success: false, error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.' });
    }

    // 코드 불일치
    if (verification.code !== String(code)) {
      await db.query(
        'UPDATE phone_verifications SET attempts = attempts + 1 WHERE phone_verification_id = ?',
        [verification.phone_verification_id]
      );
      const remaining = 4 - verification.attempts;
      return res.status(400).json({ success: false, error: `인증 코드가 올바르지 않습니다. (남은 시도: ${remaining}회)` });
    }

    // 인증 성공
    await db.query(
      'UPDATE phone_verifications SET verified = 1, verified_at = NOW() WHERE phone_verification_id = ?',
      [verification.phone_verification_id]
    );

    // 로그인된 유저라면 phone_verified 업데이트
    // (회원가입 전 인증이면 프론트에서 토큰 없이 호출)
    if (req.user) {
      await db.query(
        'UPDATE users SET phone = ?, phone_verified = 1 WHERE user_id = ?',
        [phone, req.user.userId]
      );
    }

    res.json({ success: true, message: '전화번호 인증이 완료되었습니다.', verified: true });
  } catch (error) {
    console.error('verifyCode:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

exports.getVerificationStatus = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT phone, phone_verified FROM users WHERE user_id = ?',
      [req.user.userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });

    res.json({
      success: true,
      data: {
        phone: rows[0].phone,
        phone_verified: !!rows[0].phone_verified
      }
    });
  } catch (error) {
    console.error('getVerificationStatus:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
