const db = require('../config/db');

/** 건강 리포트 생성 (주간/월간 - 스케줄 또는 수동) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pet_id, report_type, period_start, period_end } = req.body;

    if (!pet_id || !report_type || !period_start || !period_end) {
      return res.status(400).json({ success: false, error: 'pet_id, report_type, period_start, period_end는 필수입니다.' });
    }
    if (!['weekly', 'monthly'].includes(report_type)) {
      return res.status(400).json({ success: false, error: 'report_type은 weekly 또는 monthly여야 합니다.' });
    }

    const [pet] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [pet_id, userId]);
    if (pet.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO health_reports (pet_id, user_id, report_type, period_start, period_end)
       VALUES (?, ?, ?, ?, ?)`,
      [pet_id, userId, report_type, period_start, period_end]
    );

    const [rows] = await db.query('SELECT * FROM health_reports WHERE health_report_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('healthReport create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 건강 리포트 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.query.pet_id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM health_reports WHERE user_id = ?';
    const params = [userId];
    if (petId) { sql += ' AND pet_id = ?'; params.push(petId); }
    sql += ' ORDER BY period_end DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('healthReport list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 건강 리포트 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const reportId = req.params.reportId;
    const [rows] = await db.query('SELECT * FROM health_reports WHERE health_report_id = ? AND user_id = ?', [reportId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '리포트를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('healthReport getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
