const db = require('../config/db');

/** 건강 체크 요청 생성 (증상/행동·울음 분석 ID 입력, AI는 외부에서 결과 전달) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pet_id, symptoms, behavior_analysis_id, sound_analysis_id } = req.body;

    if (!pet_id) {
      return res.status(400).json({ success: false, error: 'pet_id는 필수입니다.' });
    }

    const [pet] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [pet_id, userId]);
    if (pet.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }

    const symptomsJson = symptoms ? (typeof symptoms === 'string' ? symptoms : JSON.stringify(symptoms)) : null;

    const [result] = await db.query(
      `INSERT INTO health_checks (pet_id, user_id, symptoms, behavior_analysis_id, sound_analysis_id)
       VALUES (?, ?, ?, ?, ?)`,
      [pet_id, userId, symptomsJson, behavior_analysis_id || null, sound_analysis_id || null]
    );

    const [rows] = await db.query('SELECT * FROM health_checks WHERE health_check_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('healthCheck create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** AI 결과 수신 (외부 AI API에서 호출) */
exports.receiveResult = async (req, res) => {
  try {
    const checkId = req.params.checkId;
    const {
      predicted_diseases,
      urgency_level,
      recommendations,
      should_visit_hospital,
      health_score
    } = req.body;

    const [existing] = await db.query('SELECT health_check_id FROM health_checks WHERE health_check_id = ?', [checkId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '건강 체크 요청을 찾을 수 없습니다.' });
    }

    const updates = [];
    const values = [];
    if (predicted_diseases !== undefined) { updates.push('predicted_diseases = ?'); values.push(JSON.stringify(predicted_diseases)); }
    if (urgency_level !== undefined) { updates.push('urgency_level = ?'); values.push(urgency_level); }
    if (recommendations !== undefined) { updates.push('recommendations = ?'); values.push(recommendations); }
    if (should_visit_hospital !== undefined) { updates.push('should_visit_hospital = ?'); values.push(should_visit_hospital ? 1 : 0); }
    if (health_score !== undefined) { updates.push('health_score = ?'); values.push(health_score); }

    values.push(checkId);
    await db.query(`UPDATE health_checks SET ${updates.join(', ')} WHERE health_check_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM health_checks WHERE health_check_id = ?', [checkId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('healthCheck receiveResult:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 건강 체크 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.query.pet_id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM health_checks WHERE user_id = ?';
    const params = [userId];
    if (petId) { sql += ' AND pet_id = ?'; params.push(petId); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('healthCheck list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 건강 체크 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const checkId = req.params.checkId;
    const [rows] = await db.query('SELECT * FROM health_checks WHERE health_check_id = ? AND user_id = ?', [checkId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '건강 체크 결과를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('healthCheck getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
