const db = require('../config/db');

/** 댓글 등록 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;
    const { content, parent_comment_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '댓글 내용은 필수입니다.' });
    }

    const [post] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND is_deleted = 0', [communityId]);
    if (post.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
    }

    const [result] = await db.query(
      `INSERT INTO comments (community_id, user_id, parent_comment_id, content)
       VALUES (?, ?, ?, ?)`,
      [communityId, userId, parent_comment_id || null, content.trim()]
    );

    await db.query('UPDATE community SET comment_count = comment_count + 1 WHERE community_id = ?', [communityId]);

    const [rows] = await db.query(
      `SELECT co.*, u.name as user_name FROM comments co
       JOIN users u ON u.user_id = co.user_id
       WHERE co.comment_id = ? AND (u.deleted_at IS NULL)`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('comment create:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 게시글별 댓글 목록 */
exports.list = async (req, res) => {
  try {
    const communityId = req.params.communityId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT co.*, u.name as user_name FROM comments co
       JOIN users u ON u.user_id = co.user_id
       WHERE co.community_id = ? AND co.is_deleted = 0 AND co.is_blocked = 0 AND (u.deleted_at IS NULL)
       ORDER BY co.parent_comment_id ASC, co.created_at ASC
       LIMIT ? OFFSET ?`,
      [communityId, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('comment list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 댓글 수정 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.userId;
    const commentId = req.params.commentId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '댓글 내용은 필수입니다.' });
    }

    const [result] = await db.query('UPDATE comments SET content = ? WHERE comment_id = ? AND user_id = ?', [content.trim(), commentId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '댓글을 찾을 수 없거나 수정 권한이 없습니다.' });
    }

    const [rows] = await db.query('SELECT * FROM comments WHERE comment_id = ?', [commentId]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('comment update:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 댓글 삭제 (소프트) */
exports.remove = async (req, res) => {
  try {
    const userId = req.user.userId;
    const commentId = req.params.commentId;

    const [comment] = await db.query('SELECT community_id FROM comments WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
    if (comment.length === 0) {
      return res.status(404).json({ success: false, error: '댓글을 찾을 수 없거나 삭제 권한이 없습니다.' });
    }

    await db.query('UPDATE comments SET is_deleted = 1 WHERE comment_id = ?', [commentId]);
    await db.query('UPDATE community SET comment_count = comment_count - 1 WHERE community_id = ?', [comment[0].community_id]);
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    console.error('comment remove:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
