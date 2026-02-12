const db = require('../config/db');

/** 지역별 동물병원 검색 (위도/경도 또는 주소 기반) */
exports.search = async (req, res) => {
  try {
    const { lat, lng, radius_km = 10, name, limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    let sql = 'SELECT * FROM hospitals WHERE is_active = 1';
    const params = [];

    if (lat && lng) {
      sql += ` AND (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) <= ?`;
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(radius_km));
    }
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    sql += ' ORDER BY average_rating DESC, total_reviews DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('hospital search:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 병원 상세 */
exports.getById = async (req, res) => {
  try {
    const hospitalId = req.params.hospitalId;
    const [hospitals] = await db.query('SELECT * FROM hospitals WHERE hospital_id = ? AND is_active = 1', [hospitalId]);
    if (hospitals.length === 0) {
      return res.status(404).json({ success: false, error: '병원을 찾을 수 없습니다.' });
    }

    const [prices] = await db.query('SELECT * FROM hospital_prices WHERE hospital_id = ? ORDER BY treatment_type', [hospitalId]);
    const [reviews] = await db.query(
      `SELECT hr.*, u.name as user_name FROM hospital_reviews hr
       JOIN users u ON u.user_id = hr.user_id
       WHERE hr.hospital_id = ? AND (u.deleted_at IS NULL) ORDER BY hr.created_at DESC LIMIT 10`,
      [hospitalId]
    );

    res.json({
      success: true,
      data: {
        ...hospitals[0],
        prices,
        recent_reviews: reviews
      }
    });
  } catch (error) {
    console.error('hospital getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 질병/진료별 예상 비용 조회 (병원별 또는 지역 평균) */
exports.getPrices = async (req, res) => {
  try {
    const { treatment_type, species, hospital_id } = req.query;
    if (!treatment_type) {
      return res.status(400).json({ success: false, error: 'treatment_type은 필수입니다.' });
    }

    let sql = `SELECT hp.*, h.name as hospital_name, h.address, h.average_rating
               FROM hospital_prices hp
               JOIN hospitals h ON h.hospital_id = hp.hospital_id
               WHERE hp.treatment_type LIKE ? AND h.is_active = 1`;
    const params = [`%${treatment_type}%`];
    if (species) {
      sql += ' AND hp.species = ?';
      params.push(species);
    }
    if (hospital_id) {
      sql += ' AND hp.hospital_id = ?';
      params.push(hospital_id);
    }
    sql += ' ORDER BY hp.average_price ASC';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('hospital getPrices:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 병원 리뷰 등록 */
exports.createReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const hospitalId = req.params.hospitalId;
    const { pet_id, rating, treatment_type, cost, title, content, kindness_rating, facility_rating, price_rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: '평점(1~5)은 필수입니다.' });
    }

    const [h] = await db.query('SELECT hospital_id FROM hospitals WHERE hospital_id = ?', [hospitalId]);
    if (h.length === 0) {
      return res.status(404).json({ success: false, error: '병원을 찾을 수 없습니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO hospital_reviews (hospital_id, user_id, pet_id, rating, treatment_type, cost, title, content, kindness_rating, facility_rating, price_rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hospitalId,
        userId,
        pet_id || null,
        rating,
        treatment_type || null,
        cost ? parseInt(cost, 10) : null,
        title || null,
        content || null,
        kindness_rating ? Math.min(5, Math.max(1, parseInt(kindness_rating, 10))) : null,
        facility_rating ? Math.min(5, Math.max(1, parseInt(facility_rating, 10))) : null,
        price_rating ? Math.min(5, Math.max(1, parseInt(price_rating, 10))) : null
      ]
    );

    await db.query(
      `UPDATE hospitals SET
        average_rating = (SELECT AVG(rating) FROM hospital_reviews WHERE hospital_id = ?),
        total_reviews = (SELECT COUNT(*) FROM hospital_reviews WHERE hospital_id = ?)
       WHERE hospital_id = ?`,
      [hospitalId, hospitalId, hospitalId]
    );

    const [rows] = await db.query('SELECT * FROM hospital_reviews WHERE hospital_review_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('hospital createReview:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 병원 리뷰 목록 */
exports.getReviews = async (req, res) => {
  try {
    const hospitalId = req.params.hospitalId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT hr.*, u.name as user_name FROM hospital_reviews hr
       JOIN users u ON u.user_id = hr.user_id
       WHERE hr.hospital_id = ? AND (u.deleted_at IS NULL) ORDER BY hr.created_at DESC LIMIT ? OFFSET ?`,
      [hospitalId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('hospital getReviews:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 병원 즐겨찾기 추가 */
exports.addFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const hospitalId = req.params.hospitalId;

    const [h] = await db.query('SELECT hospital_id FROM hospitals WHERE hospital_id = ?', [hospitalId]);
    if (h.length === 0) {
      return res.status(404).json({ success: false, error: '병원을 찾을 수 없습니다.' });
    }

    await db.query('INSERT IGNORE INTO hospital_favorites (user_id, hospital_id) VALUES (?, ?)', [userId, hospitalId]);
    const [rows] = await db.query('SELECT * FROM hospital_favorites WHERE user_id = ? AND hospital_id = ?', [userId, hospitalId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('hospital addFavorite:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 병원 즐겨찾기 해제 */
exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const hospitalId = req.params.hospitalId;
    const [result] = await db.query('DELETE FROM hospital_favorites WHERE user_id = ? AND hospital_id = ?', [userId, hospitalId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '즐겨찾기를 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '즐겨찾기가 해제되었습니다.' });
  } catch (error) {
    console.error('hospital removeFavorite:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 즐겨찾기 병원 목록 */
exports.getMyFavorites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await db.query(
      `SELECT h.* FROM hospitals h
       JOIN hospital_favorites hf ON hf.hospital_id = h.hospital_id
       WHERE hf.user_id = ? AND h.is_active = 1 ORDER BY hf.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('hospital getMyFavorites:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
