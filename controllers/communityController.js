const db = require('../config/db');

/** 파일 mimetype → community_media.media_type */
function getMediaType(mimetype) {
  if (!mimetype) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'image';
}

/** 게시글 등록 (미디어 첨부 시 community_media에 저장) */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pet_id, category, title, content, hashtags } = req.body || {};

    if (!category || !title || !content) {
      return res.status(400).json({ success: false, error: '카테고리, 제목, 내용은 필수입니다.' });
    }
    const validCategory = ['question', 'info', 'brag', 'review', 'free'];
    if (!validCategory.includes(category)) {
      return res.status(400).json({ success: false, error: '카테고리는 question, info, brag, review, free 중 하나여야 합니다.' });
    }

    const hashtagsJson = hashtags ? (Array.isArray(hashtags) ? JSON.stringify(hashtags) : (typeof hashtags === 'string' ? hashtags : '[]')) : '[]';

    const [result] = await db.query(
      `INSERT INTO community (user_id, pet_id, category, title, content, hashtags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, pet_id || null, category, title, content, hashtagsJson]
    );

    const communityId = result.insertId;

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const mediaType = getMediaType(file.mimetype);
        const filePath = `community/${file.filename}`;
        await db.query(
          `INSERT INTO community_media (community_id, media_type, file_path, display_order, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [communityId, mediaType, filePath, i, file.size || null]
        );
      }
    }

    await db.query('UPDATE users SET community_count = community_count + 1 WHERE user_id = ?', [userId]);

    const [rows] = await db.query('SELECT * FROM community WHERE community_id = ?', [communityId]);
    const [media] = await db.query('SELECT * FROM community_media WHERE community_id = ? ORDER BY display_order', [communityId]);
    res.status(201).json({ success: true, data: { ...rows[0], media } });
  } catch (error) {
    console.error('community create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글 목록 (카테고리/해시태그/검색) */
exports.list = async (req, res) => {
  try {
    const { category, hashtag, q, best, limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    let sql = `SELECT c.*, u.name as user_name
               FROM community c
               JOIN users u ON u.user_id = c.user_id
               WHERE c.is_deleted = 0 AND c.is_blocked = 0 AND (u.deleted_at IS NULL)`;
    const params = [];

    if (category) {
      sql += ' AND c.category = ?';
      params.push(category);
    }
    if (hashtag) {
      sql += ' AND JSON_CONTAINS(c.hashtags, ?)';
      params.push(JSON.stringify(hashtag));
    }
    if (q) {
      sql += ' AND (c.title LIKE ? OR c.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (best === '1' || best === 'true') {
      sql += ' AND c.is_best = 1';
    }

    sql += ' ORDER BY c.is_best DESC, c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('community list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글 상세 */
exports.getById = async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const [posts] = await db.query(
      `SELECT c.*, u.name as user_name FROM community c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.community_id = ? AND c.is_deleted = 0 AND c.is_blocked = 0 AND (u.deleted_at IS NULL)`,
      [communityId]
    );
    if (posts.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
    }

    await db.query('UPDATE community SET view_count = view_count + 1 WHERE community_id = ?', [communityId]);
    const [media] = await db.query('SELECT * FROM community_media WHERE community_id = ? ORDER BY display_order', [communityId]);

    res.json({
      success: true,
      data: {
        ...posts[0],
        view_count: posts[0].view_count + 1,
        media
      }
    });
  } catch (error) {
    console.error('community getById:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글 수정 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;
    const { category, title, content, hashtags } = req.body;

    const [existing] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND user_id = ?', [communityId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없거나 수정 권한이 없습니다.' });
    }

    const updates = [];
    const values = [];
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (hashtags !== undefined) {
      updates.push('hashtags = ?');
      values.push(Array.isArray(hashtags) ? JSON.stringify(hashtags) : hashtags);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '수정할 필드를 입력해주세요.' });
    }
    values.push(communityId);
    await db.query(`UPDATE community SET ${updates.join(', ')} WHERE community_id = ?`, values);

    const [rows] = await db.query('SELECT * FROM community WHERE community_id = ?', [communityId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('community update:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글 삭제 (소프트) */
exports.remove = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;
    const [result] = await db.query('UPDATE community SET is_deleted = 1 WHERE community_id = ? AND user_id = ?', [communityId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없거나 삭제 권한이 없습니다.' });
    }
    await db.query('UPDATE users SET community_count = community_count - 1 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    console.error('community remove:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글에 미디어 추가 (community_media에 삽입) */
exports.addMedia = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;
    const files = req.files || [];

    const [post] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND user_id = ? AND is_deleted = 0', [communityId, userId]);
    if (post.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없거나 수정 권한이 없습니다.' });
    }

    const [existing] = await db.query('SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM community_media WHERE community_id = ?', [communityId]);
    let displayOrder = existing[0]?.next_order ?? 0;

    const inserted = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaType = getMediaType(file.mimetype);
      const filePath = `community/${file.filename}`;
      const [result] = await db.query(
        `INSERT INTO community_media (community_id, media_type, file_path, display_order, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [communityId, mediaType, filePath, displayOrder + i, file.size || null]
      );
      const [row] = await db.query('SELECT * FROM community_media WHERE community_media_id = ?', [result.insertId]);
      inserted.push(row[0]);
    }

    res.status(201).json({ success: true, data: inserted });
  } catch (error) {
    console.error('community addMedia:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글 미디어 삭제 (community_media에서 삭제) */
exports.removeMedia = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;
    const mediaId = req.params.mediaId;

    const [post] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND user_id = ?', [communityId, userId]);
    if (post.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없거나 삭제 권한이 없습니다.' });
    }

    const [result] = await db.query('DELETE FROM community_media WHERE community_media_id = ? AND community_id = ?', [mediaId, communityId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '미디어를 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '미디어가 삭제되었습니다.' });
  } catch (error) {
    console.error('community removeMedia:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 베스트 게시글 선정 (관리자용 - 추후 is_best 플래그 업데이트) */
exports.listBest = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const [rows] = await db.query(
      `SELECT c.*, u.name as user_name FROM community c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.is_deleted = 0 AND c.is_blocked = 0 AND c.is_best = 1 AND (u.deleted_at IS NULL)
       ORDER BY c.like_count DESC, c.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('community listBest:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
