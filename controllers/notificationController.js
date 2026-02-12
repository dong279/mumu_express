const db = require('../config/db');

/** 내 알림 목록 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.userId;
    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];
    if (unreadOnly) { sql += ' AND is_read = 0'; }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('notification list:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 알림 읽음 처리 */
exports.markRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.notificationId;
    const [result] = await db.query('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [notificationId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '알림을 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '읽음 처리되었습니다.' });
  } catch (error) {
    console.error('notification markRead:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};

/** 전체 읽음 처리 */
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: '모든 알림을 읽음 처리했습니다.' });
  } catch (error) {
    console.error('notification markAllRead:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
};
