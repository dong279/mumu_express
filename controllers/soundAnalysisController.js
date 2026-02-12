const db = require('../config/db');

/** 울음소리 분석 요청 생성 (음성 업로드 후 저장, AI는 외부에서 결과 전달) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pet_id } = req.body;
    const audioPath = req.file ? `sound/${req.file.filename}` : null;

    if (!pet_id) {
      return res.status(400).json({ success: false, error: 'pet_id는 필수입니다.' });
    }

    const [pet] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [pet_id, userId]);
    if (pet.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO sound_analyses (pet_id, user_id, audio_path, analysis_status)
       VALUES (?, ?, ?, 'processing')`,
      [pet_id, userId, audioPath]
    );

    const [rows] = await db.query('SELECT * FROM sound_analyses WHERE sound_analysis_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('sound create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** AI 결과 수신 (외부 AI API에서 호출) */
exports.receiveResult = async (req, res) => {
  try {
    const analysisId = req.params.analysisId;
    const {
      analysis_status,
      emotion,
      sound_type,
      intensity,
      frequency_analysis,
      health_indicators,
      model_version,
      processing_time
    } = req.body;

    const [existing] = await db.query('SELECT sound_analysis_id FROM sound_analyses WHERE sound_analysis_id = ?', [analysisId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '분석 요청을 찾을 수 없습니다.' });
    }

    const updates = [];
    const values = [];
    if (analysis_status !== undefined) { updates.push('analysis_status = ?'); values.push(analysis_status); }
    if (emotion !== undefined) { updates.push('emotion = ?'); values.push(JSON.stringify(emotion)); }
    if (sound_type !== undefined) { updates.push('sound_type = ?'); values.push(sound_type); }
    if (intensity !== undefined) { updates.push('intensity = ?'); values.push(intensity); }
    if (frequency_analysis !== undefined) { updates.push('frequency_analysis = ?'); values.push(JSON.stringify(frequency_analysis)); }
    if (health_indicators !== undefined) { updates.push('health_indicators = ?'); values.push(JSON.stringify(health_indicators)); }
    if (model_version !== undefined) { updates.push('model_version = ?'); values.push(model_version); }
    if (processing_time !== undefined) { updates.push('processing_time = ?'); values.push(processing_time); }

    updates.push('analyzed_at = NOW()');
    values.push(analysisId);
    await db.query(`UPDATE sound_analyses SET ${updates.join(', ')} WHERE sound_analysis_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM sound_analyses WHERE sound_analysis_id = ?', [analysisId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('sound receiveResult:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 울음소리 분석 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.query.pet_id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM sound_analyses WHERE user_id = ?';
    const params = [userId];
    if (petId) { sql += ' AND pet_id = ?'; params.push(petId); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('sound list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 울음소리 분석 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const analysisId = req.params.analysisId;
    const [rows] = await db.query('SELECT * FROM sound_analyses WHERE sound_analysis_id = ? AND user_id = ?', [analysisId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '분석 결과를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('sound getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
