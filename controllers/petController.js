const db = require('../config/db');

/** 반려동물 등록 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      species,
      breed,
      gender,
      birth_date,
      weight,
      profile_image,
      neutered,
      allergies,
      chronic_diseases,
      medications
    } = req.body;

    if (!name || !species) {
      return res.status(400).json({ success: false, error: '이름과 종(개/고양이/기타)은 필수입니다.' });
    }
    const validSpecies = ['dog', 'cat', 'other'];
    if (!validSpecies.includes(species)) {
      return res.status(400).json({ success: false, error: '종은 dog, cat, other 중 하나여야 합니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO pets (user_id, name, species, breed, gender, birth_date, weight, profile_image, neutered, allergies, chronic_diseases, medications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        species,
        breed || null,
        gender || null,
        birth_date || null,
        weight ? Number(weight) : null,
        profile_image || null,
        neutered ? 1 : 0,
        allergies || null,
        chronic_diseases || null,
        medications || null
      ]
    );

    const [rows] = await db.query('SELECT * FROM pets WHERE pet_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('pet create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 반려동물 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await db.query(
      'SELECT * FROM pets WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('pet list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 반려동물 상세 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.params.petId;
    const [rows] = await db.query('SELECT * FROM pets WHERE pet_id = ? AND user_id = ? AND is_active = 1', [petId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('pet getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 반려동물 수정 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.params.petId;
    const {
      name,
      species,
      breed,
      gender,
      birth_date,
      weight,
      profile_image,
      neutered,
      allergies,
      chronic_diseases,
      medications
    } = req.body;

    const [existing] = await db.query('SELECT pet_id FROM pets WHERE pet_id = ? AND user_id = ?', [petId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }

    const updates = [];
    const values = [];
    const fields = { name, species, breed, gender, birth_date, weight, profile_image, neutered, allergies, chronic_diseases, medications };
    Object.keys(fields).forEach(key => {
      if (fields[key] !== undefined) {
        if (key === 'neutered') {
          updates.push(`${key} = ?`);
          values.push(fields[key] ? 1 : 0);
        } else if (key === 'weight') {
          updates.push(`${key} = ?`);
          values.push(Number(fields[key]) || null);
        } else {
          updates.push(`${key} = ?`);
          values.push(fields[key] || null);
        }
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '수정할 필드를 입력해주세요.' });
    }
    values.push(petId);
    await db.query(`UPDATE pets SET ${updates.join(', ')} WHERE pet_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM pets WHERE pet_id = ?', [petId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('pet update:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 반려동물 비활성화(삭제) */
exports.remove = async (req, res) => {
  try {
    const userId = req.user.userId;
    const petId = req.params.petId;
    const [result] = await db.query('UPDATE pets SET is_active = 0 WHERE pet_id = ? AND user_id = ?', [petId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '반려동물을 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    console.error('pet remove:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
