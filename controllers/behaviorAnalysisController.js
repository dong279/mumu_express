const db = require('../config/db');

/** 행동 분석 요청 생성 (영상 업로드 후 저장, AI는 외부에서 결과 전달) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pet_id } = req.body;
    const videoPath = req.file ? `behavior/${req.file.filename}` : null;

    if (!pet_id) {
      return res.status(400).json({ success: false, error: 'pet_id는 필수입니다.' });
    }

    const [pet] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [pet_id, userId]);
    if (pet.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO behavior_analyses (pet_id, user_id, video_path, analysis_status)
       VALUES (?, ?, ?, 'processing')`,
      [pet_id, userId, videoPath]
    );

    const [rows] = await db.query('SELECT * FROM behavior_analyses WHERE behavior_analysis_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('behavior create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** AI 결과 수신 (외부 AI API에서 호출) */
exports.receiveResult = async (req, res) => {
  try {
    const analysisId = req.params.analysisId;
    const {
      analysis_status,
      detected_behaviors,
      abnormal_behaviors,
      behavior_frequency,
      posture_data,
      movement_range,
      model_version,
      processing_time
    } = req.body;

    const [existing] = await db.query('SELECT behavior_analysis_id FROM behavior_analyses WHERE behavior_analysis_id = ?', [analysisId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '분석 요청을 찾을 수 없습니다.' });
    }

    const updates = [];
    const values = [];
    if (analysis_status !== undefined) { updates.push('analysis_status = ?'); values.push(analysis_status); }
    if (detected_behaviors !== undefined) { updates.push('detected_behaviors = ?'); values.push(JSON.stringify(detected_behaviors)); }
    if (abnormal_behaviors !== undefined) { updates.push('abnormal_behaviors = ?'); values.push(JSON.stringify(abnormal_behaviors)); }
    if (behavior_frequency !== undefined) { updates.push('behavior_frequency = ?'); values.push(JSON.stringify(behavior_frequency)); }
    if (posture_data !== undefined) { updates.push('posture_data = ?'); values.push(JSON.stringify(posture_data)); }
    if (movement_range !== undefined) { updates.push('movement_range = ?'); values.push(JSON.stringify(movement_range)); }
    if (model_version !== undefined) { updates.push('model_version = ?'); values.push(model_version); }
    if (processing_time !== undefined) { updates.push('processing_time = ?'); values.push(processing_time); }

    updates.push('analyzed_at = NOW()');
    values.push(analysisId);
    await db.query(`UPDATE behavior_analyses SET ${updates.join(', ')} WHERE behavior_analysis_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM behavior_analyses WHERE behavior_analysis_id = ?', [analysisId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('behavior receiveResult:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 행동 분석 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.query.pet_id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM behavior_analyses WHERE user_id = ?';
    const params = [userId];
    if (petId) {
      sql += ' AND pet_id = ?';
      params.push(petId);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('behavior list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 행동 분석 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const analysisId = req.params.analysisId;
    const [rows] = await db.query('SELECT * FROM behavior_analyses WHERE behavior_analysis_id = ? AND user_id = ?', [analysisId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '분석 결과를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('behavior getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
