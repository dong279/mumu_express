const path = require('path');
const multer = require('multer');

const rootDir = path.join(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = path.join(uploadsDir, 'default');
    if (req.baseUrl.includes('behavior')) dir = path.join(uploadsDir, 'behavior');
    else if (req.baseUrl.includes('sound')) dir = path.join(uploadsDir, 'sound');
    else if (req.baseUrl.includes('food')) dir = path.join(uploadsDir, 'food');
    else if (req.baseUrl.includes('community')) dir = path.join(uploadsDir, 'community');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
  const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm'];
  const allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowed = [...allowedVideo, ...allowedAudio, ...allowedImage];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

exports.upload = upload;
exports.singleVideo = upload.single('video');
exports.singleAudio = upload.single('audio');
exports.singleImage = upload.single('image');
exports.singleFile = upload.single('file');
// 커뮤니티 게시글 미디어 (이미지/동영상 최대 10개)
exports.communityMedia = upload.array('media', 10);
