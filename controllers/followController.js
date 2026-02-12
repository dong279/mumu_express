const db = require('../config/db');

/** 팔로우 */
exports.follow = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const targetId = parseInt(req.params.userId, 10);

    if (!targetId || Number.isNaN(targetId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }
    if (followerId === targetId) {
      return res.status(400).json({ success: false, error: '자기 자신은 팔로우할 수 없습니다.' });
    }

    const [target] = await db.query('SELECT user_id FROM users WHERE user_id = ? AND (deleted_at IS NULL)', [targetId]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, error: '대상 사용자를 찾을 수 없습니다.' });
    }

    // 이미 존재하면 무시
    const [insertResult] = await db.query(
      'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)',
      [followerId, targetId]
    );

    if (insertResult.affectedRows > 0) {
      await db.query(
        'UPDATE users SET follower_count = follower_count + 1 WHERE user_id = ?',
        [targetId]
      );
      await db.query(
        'UPDATE users SET following_count = following_count + 1 WHERE user_id = ?',
        [followerId]
      );
    }

    res.status(201).json({ success: true, message: '팔로우 완료되었습니다.' });
  } catch (error) {
    console.error('follow:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 언팔로우 */
exports.unfollow = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const targetId = parseInt(req.params.userId, 10);

    if (!targetId || Number.isNaN(targetId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }
    if (followerId === targetId) {
      return res.status(400).json({ success: false, error: '자기 자신은 언팔로우할 수 없습니다.' });
    }

    const [result] = await db.query(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, targetId]
    );

    if (result.affectedRows > 0) {
      await db.query(
        'UPDATE users SET follower_count = GREATEST(follower_count - 1, 0) WHERE user_id = ?',
        [targetId]
      );
      await db.query(
        'UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = ?',
        [followerId]
      );
    }

    res.json({ success: true, message: '언팔로우 처리되었습니다.' });
  } catch (error) {
    console.error('unfollow:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 특정 사용자의 팔로워 목록 */
exports.getFollowers = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT u.user_id, u.id, u.name, u.profile_image, f.created_at
       FROM follows f
       JOIN users u ON u.user_id = f.follower_id
       WHERE f.following_id = ? AND (u.deleted_at IS NULL)
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getFollowers:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 특정 사용자의 팔로잉 목록 */
exports.getFollowing = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, error: 'userId가 올바르지 않습니다.' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [rows] = await db.query(
      `SELECT u.user_id, u.id, u.name, u.profile_image, f.created_at
       FROM follows f
       JOIN users u ON u.user_id = f.following_id
       WHERE f.follower_id = ? AND (u.deleted_at IS NULL)
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getFollowing:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 내 팔로워/팔로잉 (편의용) */
exports.getMyFollowers = async (req, res) => {
  req.params.userId = String(req.user.userId);
  return exports.getFollowers(req, res);
};

exports.getMyFollowing = async (req, res) => {
  req.params.userId = String(req.user.userId);
  return exports.getFollowing(req, res);
};

