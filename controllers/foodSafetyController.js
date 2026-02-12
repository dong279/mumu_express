const db = require('../config/db');

/** 음식 안전성 분석 요청 생성 (음식명/이미지 입력, AI는 외부에서 결과 전달) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { food_name, pet_id } = req.body;
    const foodImage = req.file ? `food/${req.file.filename}` : null;

    if (!food_name) {
      return res.status(400).json({ success: false, error: 'food_name은 필수입니다.' });
    }

    if (pet_id) {
      const [pet] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [pet_id, userId]);
      if (pet.length === 0) {
        return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO food_safety_analyses (user_id, pet_id, food_name, food_image)
       VALUES (?, ?, ?, ?)`,
      [userId, pet_id || null, food_name, foodImage]
    );

    const [rows] = await db.query('SELECT * FROM food_safety_analyses WHERE food_safety_analysis_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('foodSafety create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** AI 결과 수신 (외부 AI API에서 호출) */
exports.receiveResult = async (req, res) => {
  try {
    const analysisId = req.params.analysisId;
    const {
      is_safe,
      safety_level,
      toxic_ingredients,
      safe_amount,
      warnings,
      alternatives,
      model_version,
      confidence
    } = req.body;

    const [existing] = await db.query('SELECT food_safety_analysis_id FROM food_safety_analyses WHERE food_safety_analysis_id = ?', [analysisId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '분석 요청을 찾을 수 없습니다.' });
    }

    const updates = [];
    const values = [];
    if (is_safe !== undefined) { updates.push('is_safe = ?'); values.push(is_safe ? 1 : 0); }
    if (safety_level !== undefined) { updates.push('safety_level = ?'); values.push(safety_level); }
    if (toxic_ingredients !== undefined) { updates.push('toxic_ingredients = ?'); values.push(JSON.stringify(toxic_ingredients)); }
    if (safe_amount !== undefined) { updates.push('safe_amount = ?'); values.push(safe_amount); }
    if (warnings !== undefined) { updates.push('warnings = ?'); values.push(warnings); }
    if (alternatives !== undefined) { updates.push('alternatives = ?'); values.push(JSON.stringify(alternatives)); }
    if (model_version !== undefined) { updates.push('model_version = ?'); values.push(model_version); }
    if (confidence !== undefined) { updates.push('confidence = ?'); values.push(confidence); }

    values.push(analysisId);
    await db.query(`UPDATE food_safety_analyses SET ${updates.join(', ')} WHERE food_safety_analysis_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM food_safety_analyses WHERE food_safety_analysis_id = ?', [analysisId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('foodSafety receiveResult:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 음식 안전성 분석 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      'SELECT * FROM food_safety_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('foodSafety list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 음식 안전성 분석 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const analysisId = req.params.analysisId;
    const [rows] = await db.query('SELECT * FROM food_safety_analyses WHERE food_safety_analysis_id = ? AND user_id = ?', [analysisId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '분석 결과를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('foodSafety getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
