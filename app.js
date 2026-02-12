require('dotenv').config({ path: './config/.env' });
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const db = require('./config/db');

const isProduction = process.env.NODE_ENV === 'production';

['uploads', 'uploads/behavior', 'uploads/sound', 'uploads/food', 'uploads/community'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 100 : 500,
  message: { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

const cors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AI-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
};
app.use(cors);

app.use('/api/users', require('./routes/users.routes'));
app.use('/api/pets', require('./routes/pets.routes'));
app.use('/api/behavior-analysis', require('./routes/behavior.routes'));
app.use('/api/sound-analysis', require('./routes/sound.routes'));
app.use('/api/health-check', require('./routes/healthCheck.routes'));
app.use('/api/food-safety', require('./routes/foodSafety.routes'));
app.use('/api/hospitals', require('./routes/hospitals.routes'));
app.use('/api/community', require('./routes/community.routes'));
app.use('/api/community/:communityId/comments', require('./routes/comments.routes'));
app.use('/api/likes', require('./routes/likes.routes'));
app.use('/api/bookmarks', require('./routes/bookmarks.routes'));
app.use('/api/follows', require('./routes/follows.routes'));
app.use('/api/health-reports', require('./routes/healthReports.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/reports', require('./routes/reports.routes'));

app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ success: true, message: 'DB 연결 성공!', result: rows[0].result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'DB 연결 실패', error: error.message });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: '파일 크기 제한을 초과했습니다.' });
  }
  console.error(err);
  const message = isProduction ? '서버 오류가 발생했습니다.' : (err.message || '서버 오류가 발생했습니다.');
  res.status(500).json({ success: false, error: message });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '요청한 경로를 찾을 수 없습니다.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
});
