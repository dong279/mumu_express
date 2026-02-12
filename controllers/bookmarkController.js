const db = require('../config/db');

/** 게시글 스크랩 토글 */
exports.toggle = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;

    const [post] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND is_deleted = 0', [communityId]);
    if (post.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
    }

    const [existing] = await db.query('SELECT community_bookmark_id FROM community_bookmarks WHERE user_id = ? AND community_id = ?', [userId, communityId]);
    let bookmarked;
    if (existing.length > 0) {
      await db.query('DELETE FROM community_bookmarks WHERE user_id = ? AND community_id = ?', [userId, communityId]);
      await db.query('UPDATE community SET bookmark_count = bookmark_count - 1 WHERE community_id = ?', [communityId]);
      bookmarked = false;
    } else {
      await db.query('INSERT INTO community_bookmarks (user_id, community_id) VALUES (?, ?)', [userId, communityId]);
      await db.query('UPDATE community SET bookmark_count = bookmark_count + 1 WHERE community_id = ?', [communityId]);
      bookmarked = true;
    }
    res.json({ success: true, bookmarked });
  } catch (error) {
    console.error('bookmark toggle:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 스크랩 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT c.*, u.name as user_name FROM community c
       JOIN users u ON u.user_id = c.user_id
       JOIN community_bookmarks cb ON cb.community_id = c.community_id
       WHERE cb.user_id = ? AND c.is_deleted = 0 AND c.is_blocked = 0 AND (u.deleted_at IS NULL)
       ORDER BY cb.created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('bookmark list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
