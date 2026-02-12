const db = require('../config/db');

/** 게시글 좋아요 토글 */
exports.toggleCommunityLike = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communityId = req.params.communityId;

    const [post] = await db.query('SELECT community_id FROM community WHERE community_id = ? AND is_deleted = 0', [communityId]);
    if (post.length === 0) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
    }

    const [existing] = await db.query('SELECT community_like_id FROM community_likes WHERE user_id = ? AND community_id = ?', [userId, communityId]);
    let liked;
    if (existing.length > 0) {
      await db.query('DELETE FROM community_likes WHERE user_id = ? AND community_id = ?', [userId, communityId]);
      await db.query('UPDATE community SET like_count = like_count - 1 WHERE community_id = ?', [communityId]);
      liked = false;
    } else {
      await db.query('INSERT INTO community_likes (user_id, community_id) VALUES (?, ?)', [userId, communityId]);
      await db.query('UPDATE community SET like_count = like_count + 1 WHERE community_id = ?', [communityId]);
      liked = true;
    }
    const [row] = await db.query('SELECT like_count FROM community WHERE community_id = ?', [communityId]);
    res.json({ success: true, liked, like_count: row[0].like_count });
  } catch (error) {
    console.error('toggleCommunityLike:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 댓글 좋아요 토글 */
exports.toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user.userId;
    const commentId = req.params.commentId;

    const [existing] = await db.query('SELECT comment_like_id FROM comment_likes WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
    let liked;
    if (existing.length > 0) {
      await db.query('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
      await db.query('UPDATE comments SET like_count = like_count - 1 WHERE comment_id = ?', [commentId]);
      liked = false;
    } else {
      await db.query('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)', [userId, commentId]);
      await db.query('UPDATE comments SET like_count = like_count + 1 WHERE comment_id = ?', [commentId]);
      liked = true;
    }
    const [row] = await db.query('SELECT like_count FROM comments WHERE comment_id = ?', [commentId]);
    res.json({ success: true, liked, like_count: row[0].like_count });
  } catch (error) {
    console.error('toggleCommentLike:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
