const db = require('../config/db');

const REPORT_REASONS = ['spam', 'abuse', 'inappropriate', 'copyright', 'misinformation', 'other'];
const REPORTED_TYPES = ['user', 'community', 'comment'];

/** 신고 등록 */
exports.create = async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const { reported_type, reported_id, reason, description } = req.body || {};

    if (!reported_type || !reported_id || !reason) {
      return res.status(400).json({ success: false, error: 'reported_type, reported_id, reason은 필수입니다.' });
    }
    if (!REPORTED_TYPES.includes(reported_type)) {
      return res.status(400).json({ success: false, error: 'reported_type은 user, community, comment 중 하나여야 합니다.' });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, error: 'reason이 올바르지 않습니다.' });
    }

    const reportedIdNum = parseInt(reported_id, 10);
    if (!Number.isInteger(reportedIdNum) || reportedIdNum < 1) {
      return res.status(400).json({ success: false, error: 'reported_id는 양의 정수여야 합니다.' });
    }

    await db.query(
      `INSERT INTO reports (reporter_id, reported_type, reported_id, reason, description)
       VALUES (?, ?, ?, ?, ?)`,
      [reporterId, reported_type, reportedIdNum, reason, description || null]
    );

    res.status(201).json({ success: true, message: '신고가 접수되었습니다.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: '이미 해당 대상에 대해 신고하셨습니다.' });
    }
    console.error('report create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내가 한 신고 목록 */
exports.listMine = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT report_id, reported_type, reported_id, reason, status, created_at
       FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('report listMine:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
